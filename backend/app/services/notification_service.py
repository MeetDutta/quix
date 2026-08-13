from sqlalchemy.orm import Session
from typing import Optional
from app.models.notification import Notification

def create_notification(
    db: Session,
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "info",
    link: Optional[str] = None
) -> Notification:
    """Helper to dispatch in-app notifications for users."""
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
        is_read=False,
        link=link
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification
