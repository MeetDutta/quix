import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, Boolean, String
from app.database import Base

class TimeStampedModel(Base):
    __abstract__ = True
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    
    # Soft delete helper
    def delete(self):
        self.is_deleted = True
        self.updated_at = datetime.utcnow()
