from sqlalchemy import Column, String, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from app.models.base import TimeStampedModel

class Document(TimeStampedModel):
    __tablename__ = "documents"
    
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(255), nullable=False)
    file_hash = Column(String(64), unique=True, index=True, nullable=False) # For duplicate detection
    version = Column(Integer, default=1, nullable=False)
    uploader_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), index=True, nullable=True)
    subject_id = Column(String(36), ForeignKey("subjects.id"), nullable=True)
    
    uploader = relationship("User", back_populates="documents")
    subject = relationship("Subject")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(TimeStampedModel):
    __tablename__ = "document_chunks"
    
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False)
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    chunk_index = Column(Integer, nullable=False)
    
    document = relationship("Document", back_populates="chunks")
