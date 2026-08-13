from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

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
    blueprint: Optional[List[BlueprintSection]] = None
    settings: Optional[Dict[str, Any]] = None # Fullscreen, shuffle, proctor limits

class ExamResponse(BaseModel):
    id: str
    name: str
    subject_id: str
    duration_minutes: int
    total_marks: float
    negative_marking: Optional[float] = 0.0
    passing_marks: float
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    exam_code: str
    is_published: Optional[bool] = False
    questions_json: Optional[str] = None

    class Config:
        from_attributes = True

class CredentialResponse(BaseModel):
    username: str
    password: str
    student_name: Optional[str]
    roll_number: Optional[str]
    expires_at: datetime

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

class ExamGenerateKBRequest(BaseModel):
    name: str
    subject_id: Optional[str] = "general_101"
    document_id: Optional[str] = None
    topic: Optional[str] = "General"
    duration_minutes: Optional[int] = 30
    total_marks: Optional[float] = 50.0
    passing_marks: Optional[float] = 20.0
    negative_marking: Optional[float] = 0.0
    num_mcq: Optional[int] = 5
    num_subjective: Optional[int] = 0
    question_type: Optional[str] = "mcq"
    difficulty: Optional[str] = "medium"
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

