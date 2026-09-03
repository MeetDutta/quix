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
    // Merge server saved answers with any un-synced local buffer from browser storage
    let effectiveAnswers = { ...savedAnswers };
    if (typeof window !== 'undefined') {
      try {
        const localRaw = localStorage.getItem(`answers_${token}`);
        if (localRaw) {
          const localParsed = JSON.parse(localRaw);
          if (localParsed && typeof localParsed === 'object') {
            effectiveAnswers = { ...effectiveAnswers, ...localParsed };
          }
        }
      } catch {}
    }

    set({
      sessionToken: token,
      examName: name,
      durationMinutes: duration,
      timeRemainingSeconds: serverTimeRemaining !== undefined ? serverTimeRemaining : duration * 60,
      questions,
      answers: effectiveAnswers,
      proctorEventsCount: 0
    });
  },
  
  updateAnswer: (questionId, answer) => {
    set((state) => {
      const newAnswers = { ...state.answers, [questionId]: answer };
      // Save locally to support offline recovery!
      if (typeof window !== 'undefined' && state.sessionToken) {
        try {
          localStorage.setItem(`answers_${state.sessionToken}`, JSON.stringify(newAnswers));
        } catch {}
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
    set((state) => {
      if (typeof window !== 'undefined' && state.sessionToken) {
        try {
          localStorage.removeItem(`answers_${state.sessionToken}`);
        } catch {}
      }
      return {
        sessionToken: null,
        examName: null,
        durationMinutes: 0,
        timeRemainingSeconds: 0,
        questions: [],
        answers: {},
        proctorEventsCount: 0
      };
    });
  }
}));
