from pydantic import BaseModel, ConfigDict, model_validator, field_serializer
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

class BlueprintSection(BaseModel):
    topic: str
    difficulty: str
    question_type: str
    marks: int
    count: int

class ExamCreate(BaseModel):
    name: str
    subject_id: str
    duration_minutes: int
    total_marks: int
    negative_marking: Optional[float] = 0.0
    passing_marks: int
    start_time: datetime
    end_time: datetime
    student_directory_id: Optional[str] = None
    blueprint: Optional[List[BlueprintSection]] = None
    settings: Optional[Dict[str, Any]] = None # Fullscreen, shuffle, proctor limits

class ExamResponse(BaseModel):
    id: str
    name: str
    subject_id: str
    workspace_id: Optional[str] = None
    created_by: Optional[str] = None
    student_directory_id: Optional[str] = None
    duration_minutes: int
    total_marks: float
    negative_marking: Optional[float] = 0.0
    passing_marks: float
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    exam_code: str
    is_published: Optional[bool] = False
    questions_json: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("start_time", "end_time", when_used="json")
    def serialize_datetime(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc).isoformat()
        return dt.astimezone(timezone.utc).isoformat()


class CredentialResponse(BaseModel):
    username: str
    password: str
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    email: Optional[str] = None
    roll_number: Optional[str] = None
    expires_at: datetime

    @field_serializer("expires_at", when_used="json")
    def serialize_expires_at(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc).isoformat()
        return dt.astimezone(timezone.utc).isoformat()

class ExamLogin(BaseModel):
    username: str
    password: str

class SubmissionAnswer(BaseModel):
    question_id: str
    answer: Any  # Multiple answers format, text, etc.

class SubmitExam(BaseModel):
    answers: List[SubmissionAnswer]

class ProctorLogCreate(BaseModel):
    event_type: str  # tab_switch, copy_paste, devtools, resize, idle
    event_details: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any):
        if isinstance(data, dict):
            if "event_type" not in data and "alert_type" in data:
                data["event_type"] = data["alert_type"]
            if "event_details" not in data and "details" in data:
                data["event_details"] = data["details"]
        return data

class ExamGenerateKBRequest(BaseModel):
    name: str
    subject_id: Optional[str] = "general_101"
    document_id: Optional[str] = None
    student_directory_id: Optional[str] = None
    topic: Optional[str] = "General"
    duration_minutes: Optional[int] = 30
    total_marks: Optional[float] = 50.0
    passing_marks: Optional[float] = 20.0
    negative_marking: Optional[float] = 0.0
    num_questions: Optional[int] = None
    num_mcq: Optional[int] = None
    num_subjective: Optional[int] = None
    question_type: Optional[str] = "mcq"
    difficulty: Optional[str] = "medium"
    custom_instructions: Optional[str] = None
    blueprint: Optional[Dict[str, Any]] = None
    marks_distribution: Optional[Dict[str, Any]] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class UpdateQuestionsRequest(BaseModel):
    questions: List[Dict[str, Any]]

class RegenerateQuestionRequest(BaseModel):
    question_index: int
    topic: Optional[str] = None
    difficulty: Optional[str] = "medium"
    question_type: Optional[str] = "mcq"
    custom_instruction: Optional[str] = None

class AuditPaperRequest(BaseModel):
    questions: List[Dict[str, Any]]

class RerollPromptRequest(BaseModel):
    original_question: Dict[str, Any]
    prompt_feedback: str
    subject_id: Optional[str] = None

