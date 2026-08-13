from sqlalchemy import Column, String, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.models.base import TimeStampedModel

class Notification(TimeStampedModel):
    __tablename__ = "notifications"
    
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    type = Column(String(50), default="info")  # "info", "exam", "grade", "credential", "system"
    is_read = Column(Boolean, default=False)
    link = Column(String(500), nullable=True)
    
    user = relationship("User")
