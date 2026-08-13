from sqlalchemy.orm import Session
from typing import List
from app.models.notification import Notification

def get_user_notifications(db: Session, user_id: str, unread_only: bool = False, limit: int = 20) -> List[Notification]:
    """Fetch notifications for a specific user."""
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    return query.order_by(Notification.created_at.desc()).limit(limit).all()

def get_unread_notification_count(db: Session, user_id: str) -> int:
    """Return total count of unread notifications for a user."""
    return db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).count()
