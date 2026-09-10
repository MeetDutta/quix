import uuid
from sqlalchemy import Column, DateTime, Boolean, String
from app.database import Base
from app.utils.timezone import now_utc

class TimeStampedModel(Base):
    __abstract__ = True
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    
    # Soft delete helper
    def delete(self):
        self.is_deleted = True
        self.updated_at = now_utc()

