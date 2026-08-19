from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class DocumentResponse(BaseModel):
    id: str
    title: str
    filename: str
    version: int
    uploader_id: str
    created_at: datetime
    subject_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class SearchQuery(BaseModel):
    query: str
    limit: Optional[int] = 5

class SearchResultItem(BaseModel):
    chunk_id: str
    content: str
    page_number: Optional[int]
    document_title: str
    score: float

class QuestionCreate(BaseModel):
    question_type: str
    question_text: str
    options_json: Optional[str] = None
    correct_answer: str
    explanation: Optional[str] = None
    difficulty: str
    bloom_level: Optional[str] = "applying"
    estimated_time_seconds: Optional[int] = 60
    topic: Optional[str] = None
    subtopic: Optional[str] = None
    subject_id: Optional[str] = None
    citation_chunk_id: Optional[str] = None
    confidence_score: Optional[str] = "1.0"

class QuestionResponse(BaseModel):
    id: str
    question_type: str
    question_text: str
    options_json: Optional[str]
    correct_answer: str
    explanation: Optional[str]
    difficulty: str
    bloom_level: str
    estimated_time_seconds: int
    topic: Optional[str]
    subtopic: Optional[str]
    is_approved: bool
    version: int
    confidence_score: str

    model_config = ConfigDict(from_attributes=True)


class AIQuestionGenConfig(BaseModel):
    subject_id: str
    document_ids: Optional[List[str]] = None
    question_type: str  # mcq, true_false, fill_blank, short_answer, arrange_order, etc.
    difficulty: str  # easy, medium, hard
    count: int = 5
    topic: Optional[str] = None

class BatchApproveRequest(BaseModel):
    subject_id: Optional[str] = None
    question_ids: Optional[List[str]] = None

class RefineQuestionRequest(BaseModel):
    instruction: Optional[str] = None
