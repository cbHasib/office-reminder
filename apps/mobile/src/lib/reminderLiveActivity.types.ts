export type ReminderLiveActivityPayload = {
  reminderId: string;
  title: string;
  description: string;
  startsAtISO: string;
  warningAtISO: string;
  leadMinutes: number;
};
