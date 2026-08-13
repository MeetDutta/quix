import os
import hashlib
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.document import Document, DocumentChunk
from app.models.question import Question
from app.models.institution import Subject
from app.schemas.kb import DocumentResponse, SearchQuery, SearchResultItem, QuestionResponse, AIQuestionGenConfig, QuestionCreate
from app.services.rag_service import RAGService
from app.services.ai_service import AIService
from app.utils.security import RoleChecker, get_current_user
from app.config import settings

router = APIRouter(prefix="/kb", tags=["knowledge_base"])
teacher_required = RoleChecker(["teacher", "inst_admin", "super_admin"])

rag_service = RAGService()
ai_service = AIService()

@router.post("/upload", response_model=DocumentResponse)
def upload_document(
    file: UploadFile = File(...),
    subject_id: str = Form(...),
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """
    Uploads a learning document, extracts text (PDF, Word, Slides, Image with OCR),
    chunks it, indexes it using Gemini Embeddings, and stores it in the local index.
    """
    file_bytes = file.file.read()
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    
    # Check duplicate hash (both active and deleted)
    existing = db.query(Document).filter(Document.file_hash == file_hash).first()
    if existing:
        if not existing.is_deleted:
            raise HTTPException(status_code=400, detail="This document has already been uploaded.")
        else:
            # Clean up soft-deleted record to avoid UNIQUE constraint violation on re-upload
            db.delete(existing)
            db.flush()
        
    # Save file to dedicated KB storage folder
    subject_folder = subject_id.replace(" ", "_").lower() if subject_id else "general"
    file_dir = os.path.join(settings.KB_UPLOADS_DIR, subject_folder)
    os.makedirs(file_dir, exist_ok=True)
    
    file_path = os.path.join(file_dir, file.filename)
    
    with open(file_path, "wb") as f:
        f.write(file_bytes)
        
    try:
        # 1. Parse text
        pages = rag_service.extract_text(file_path, file.filename)
        # 2. Chunk text
        chunks = rag_service.chunk_text(pages)
        
        # 3. Create document record
        clean_title = rag_service._sanitize_unicode(os.path.splitext(file.filename)[0])
        clean_filename = rag_service._sanitize_unicode(file.filename)
        doc = Document(
            title=clean_title or "Uploaded Document",
            filename=clean_filename,
            file_path=file_path,
            file_hash=file_hash,
            uploader_id=current_user.id,
            subject_id=subject_id
        )
        db.add(doc)
        db.flush() # get doc id
        
        # 4. Save chunks to db & vector index
        db_chunks = []
        for c in chunks:
            chunk_obj = DocumentChunk(
                document_id=doc.id,
                content=c["content"],
                page_number=c["page_number"],
                chunk_index=c["chunk_index"]
            )
            db.add(chunk_obj)
            db_chunks.append(chunk_obj)
        db.flush()
        
        # Format index payload
        rag_chunks = [
            {
                "chunk_id": chunk_obj.id,
                "content": chunk_obj.content,
                "page_number": chunk_obj.page_number,
                "chunk_index": chunk_obj.chunk_index
            }
            for chunk_obj in db_chunks
        ]
        
        rag_service.add_document_to_index(doc.id, doc.title, rag_chunks, subject_id=doc.subject_id)
        db.commit()
        db.refresh(doc)
        
        return doc
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
        # Clean file
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

@router.get("/documents", response_model=List[DocumentResponse])
def list_documents(
    subject_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists all uploaded documents."""
    query = db.query(Document).filter(Document.is_deleted == False)
    if subject_id:
        from sqlalchemy import func
        query = query.filter(func.lower(Document.subject_id) == func.lower(subject_id.strip()))
    return query.order_by(Document.created_at.desc()).all()

@router.get("/subjects")
def get_kb_subjects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all distinct Knowledge Base subjects with document counts and titles.
    Used by AI Question Generator to link directly with Knowledge Base subjects.
    """
    docs = db.query(Document).filter(Document.is_deleted == False).all()
    subjects_map: Dict[str, Dict[str, Any]] = {}
    
    for d in docs:
        sid = d.subject_id or "general_101"
        if sid not in subjects_map:
            subjects_map[sid] = {
                "subject_id": sid,
                "name": sid.replace("_", " ").title(),
                "document_count": 0,
                "documents": []
            }
        subjects_map[sid]["document_count"] += 1
        subjects_map[sid]["documents"].append({
            "id": d.id,
            "title": d.title,
            "filename": d.filename
        })
        
    return list(subjects_map.values())

@router.post("/search", response_model=List[SearchResultItem])
def search_kb(
    query_in: SearchQuery,
    document_ids: Optional[List[str]] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Semantic searches the index using cosine similarity and document filters."""
    results = rag_service.search_similarity(query_in.query, limit=query_in.limit, document_ids=document_ids)
    
    resp = []
    for r in results:
        resp.append(SearchResultItem(
            chunk_id=r["chunk_id"],
            content=r["content"],
            page_number=r["page_number"],
            document_title=r["doc_title"],
            score=r["score"]
        ))
    return resp

@router.post("/generate-questions", response_model=List[QuestionResponse])
def generate_ai_questions(
    config: AIQuestionGenConfig,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """
    RAG dynamic generation workflow.
    Retrieves matching chunks from vector store, triggers Gemini to build questions,
    and saves them as unapproved questions in the Database.
    """
    # 1. Retrieve related context chunks based on config topic or subject
    doc_ids = config.document_ids
    if not doc_ids and config.subject_id:
        from sqlalchemy import func
        docs = db.query(Document).filter(
            func.lower(Document.subject_id) == func.lower(config.subject_id.strip()),
            Document.is_deleted == False
        ).all()
        doc_ids = [d.id for d in docs]
        
    query = config.topic if config.topic else f"Questions about subject"
    chunks = rag_service.search_similarity(query, limit=10, document_ids=doc_ids)
    
    if not chunks:
        chunks = [{
            "chunk_id": "mock_chunk_1",
            "doc_title": "Mock RAG Document",
            "content": f"Topic: {config.topic or 'General'}. This is a mock RAG context generated as a fallback."
        }]
        
    # 2. Call Gemini question generator
    try:
        raw_questions = ai_service.generate_questions(
            context_chunks=chunks,
            question_type=config.question_type,
            difficulty=config.difficulty,
            count=config.count,
            topic=config.topic
        )
        
        db_questions = []
        for q in raw_questions:
            # Check options conversion
            opts_str = json.dumps(q.get("options")) if q.get("options") else None
            
            db_q = Question(
                subject_id=config.subject_id,
                question_type=config.question_type,
                question_text=q.get("question_text"),
                options_json=opts_str,
                correct_answer=str(q.get("correct_answer")),
                explanation=q.get("explanation"),
                difficulty=config.difficulty,
                bloom_level=q.get("bloom_level", "applying"),
                estimated_time_seconds=int(q.get("estimated_time_seconds", 60)),
                topic=q.get("topic"),
                subtopic=q.get("subtopic"),
                citation_chunk_id=q.get("citation_chunk_id"),
                confidence_score=str(q.get("confidence_score", "1.0")),
                is_approved=False
            )
            db.add(db_q)
            db_questions.append(db_q)
            
        db.commit()
        for q in db_questions:
            db.refresh(q)
        return db_questions
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Question Generation failed: {str(e)}")

@router.get("/questions", response_model=List[QuestionResponse])
def list_questions(
    db: Session = Depends(get_db),
    subject_id: Optional[str] = None,
    difficulty: Optional[str] = None,
    is_approved: Optional[bool] = None
):
    """Lists questions in the bank matching filters."""
    query = db.query(Question).filter(Question.is_deleted == False)
    if subject_id:
        from sqlalchemy import func
        query = query.filter(func.lower(Question.subject_id) == func.lower(subject_id.strip()))
    if difficulty:
        query = query.filter(Question.difficulty == difficulty)
    if is_approved is not None:
        query = query.filter(Question.is_approved == is_approved)
    return query.all()

@router.put("/questions/{question_id}", response_model=QuestionResponse)
def update_question(
    question_id: str,
    question_in: QuestionCreate,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """Updates question fields manually."""
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    q.question_text = question_in.question_text
    q.options_json = question_in.options_json
    q.correct_answer = question_in.correct_answer
    q.explanation = question_in.explanation
    q.difficulty = question_in.difficulty
    q.bloom_level = question_in.bloom_level
    q.estimated_time_seconds = question_in.estimated_time_seconds
    q.topic = question_in.topic
    q.subtopic = question_in.subtopic
    
    db.add(q)
    db.commit()
    db.refresh(q)
    return q

@router.post("/questions/{question_id}/approve")
def approve_question(
    question_id: str,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """Approves a generated question for test builders."""
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    q.is_approved = True
    db.add(q)
    db.commit()
    return {"message": "Question approved."}

@router.delete("/questions/{question_id}")
def delete_question(
    question_id: str,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """Soft deletes a question."""
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    q.delete()
    db.commit()
    return {"message": "Question deleted."}

@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: str,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """Soft deletes a document and removes it from RAG index."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.is_deleted == False).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    doc.delete()
    
    try:
        rag_service.remove_document_from_index(doc_id)
    except Exception:
        pass
        
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass
            
    db.commit()
    return {"message": "Document deleted successfully."}

from pydantic import BaseModel

class BatchApproveRequest(BaseModel):
    subject_id: Optional[str] = None
    question_ids: Optional[List[str]] = None

@router.post("/questions/batch-approve")
def batch_approve_questions(
    req: BatchApproveRequest,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    query = db.query(Question).filter(Question.is_approved == False, Question.is_deleted == False)
    if req.question_ids:
        query = query.filter(Question.id.in_(req.question_ids))
    elif req.subject_id:
        from sqlalchemy import func
        query = query.filter(func.lower(Question.subject_id) == func.lower(req.subject_id.strip()))
        
    count = query.update({Question.is_approved: True}, synchronize_session=False)
    db.commit()
    return {"message": f"Approved {count} questions successfully.", "count": count}

class RefineQuestionRequest(BaseModel):
    instruction: Optional[str] = None

@router.post("/questions/{question_id}/refine", response_model=QuestionResponse)
def refine_question_with_ai(
    question_id: str,
    req: RefineQuestionRequest,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    q = db.query(Question).filter(Question.id == question_id, Question.is_deleted == False).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    custom_inst = req.instruction if req.instruction and req.instruction.strip() else "Improve phrasing, enhance distractor options to be more plausible, and make explanation clearer."
    
    prompt = f"""
    Refine and polish the following quiz question based on this teacher instruction: "{custom_inst}"
    
    Current Question:
    Question: {q.question_text}
    Type: {q.question_type}
    Current Options: {q.options_json}
    Current Answer: {q.correct_answer}
    Current Explanation: {q.explanation}
    
    Return a JSON object matching this exact structure:
    {{
      "question_text": "Refined clear question prompt",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Correct answer matching options exactly",
      "explanation": "Clear refined explanation"
    }}
    """
    
    try:
        raw_res = ai_service._call_gemini(prompt, json_mode=True)
        data = json.loads(raw_res)
        
        q.question_text = data.get("question_text", q.question_text)
        if data.get("options") and isinstance(data.get("options"), list):
            q.options_json = json.dumps(data.get("options"))
        if data.get("correct_answer"):
            q.correct_answer = data.get("correct_answer")
        if data.get("explanation"):
            q.explanation = data.get("explanation")
            
        db.commit()
        db.refresh(q)
        return q
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refine question: {str(e)}")

@router.get("/documents/{document_id}/download")
def download_document(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Serves the raw uploaded document file from backend/uploads/kb_documents/."""
    doc = db.query(Document).filter(Document.id == document_id, Document.is_deleted == False).first()
    if not doc or not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Document file not found on server storage")
        
    return FileResponse(
        path=doc.file_path,
        filename=doc.filename,
        media_type="application/octet-stream"
    )
