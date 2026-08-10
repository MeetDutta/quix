import { create } from 'zustand';

interface ExamState {
  sessionToken: string | null;
  examName: string | null;
  durationMinutes: number;
  timeRemainingSeconds: number;
  questions: any[];
  answers: Record<string, any>;
  proctorEventsCount: number;
  setExamSession: (token: string, name: string, duration: number, questions: any[], savedAnswers?: Record<string, any>, serverTimeRemaining?: number) => void;
  updateAnswer: (questionId: string, answer: any) => void;
  decrementTime: () => void;
  incrementProctorEvents: () => void;
  clearExamSession: () => void;
}

export const useExamStore = create<ExamState>((set) => ({
  sessionToken: null,
  examName: null,
  durationMinutes: 0,
  timeRemainingSeconds: 0,
  questions: [],
  answers: {},
  proctorEventsCount: 0,
  
  setExamSession: (token, name, duration, questions, savedAnswers = {}, serverTimeRemaining) => {
    set({
      sessionToken: token,
      examName: name,
      durationMinutes: duration,
      timeRemainingSeconds: serverTimeRemaining !== undefined ? serverTimeRemaining : duration * 60,
      questions,
      answers: savedAnswers,
      proctorEventsCount: 0
    });
  },
  
  updateAnswer: (questionId, answer) => {
    set((state) => {
      const newAnswers = { ...state.answers, [questionId]: answer };
      // Save locally to support offline recovery!
      if (typeof window !== 'undefined') {
        localStorage.setItem(`answers_${state.sessionToken}`, JSON.stringify(newAnswers));
      }
      return { answers: newAnswers };
    });
  },
  
  decrementTime: () => {
    set((state) => ({
      timeRemainingSeconds: Math.max(0, state.timeRemainingSeconds - 1)
    }));
  },
  
  incrementProctorEvents: () => {
    set((state) => ({
      proctorEventsCount: state.proctorEventsCount + 1
    }));
  },
  
  clearExamSession: () => {
    set({
      sessionToken: null,
      examName: null,
      durationMinutes: 0,
      timeRemainingSeconds: 0,
      questions: [],
      answers: {},
      proctorEventsCount: 0
    });
  }
}));
