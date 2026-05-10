import NewReminderForm from "@/components/NewReminderForm";

export default function NewReminderPage({ params }: { params: { teamId: string } }) {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-6">New reminder</h1>
      <NewReminderForm teamId={params.teamId} />
    </div>
  );
}
