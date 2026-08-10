from sqlalchemy import Column, String, ForeignKey, Integer, Text, Boolean
from sqlalchemy.orm import relationship
from app.models.base import TimeStampedModel

class Question(TimeStampedModel):
    __tablename__ = "questions"
    
    subject_id = Column(String(36), ForeignKey("subjects.id"), nullable=True)
    question_type = Column(String(50), nullable=False) # MCQ, True_False, Multiple_Correct, Numerical, Fill_Blank, etc.
    question_text = Column(Text, nullable=False)
    options_json = Column(Text, nullable=True) # JSON string representation of list of options or config
    correct_answer = Column(Text, nullable=False) # JSON or string for answer matching
    explanation = Column(Text, nullable=True)
    difficulty = Column(String(50), default="medium") # easy, medium, hard
    bloom_level = Column(String(100), default="applying") # Bloom's levels
    estimated_time_seconds = Column(Integer, default=60)
    topic = Column(String(255), nullable=True)
    subtopic = Column(String(255), nullable=True)
    
    # RAG citations
    citation_chunk_id = Column(String(36), ForeignKey("document_chunks.id"), nullable=True)
    confidence_score = Column(String(50), default="1.0")
    
    is_approved = Column(Boolean, default=False)
    version = Column(Integer, default=1)
    statistics = Column(Text, nullable=True) # JSON containing usage statistics like wrong_rate, avg_score, etc.
    
    subject = relationship("Subject", back_populates="questions")
    citation_chunk = relationship("DocumentChunk")
