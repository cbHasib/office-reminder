import NewReminderForm from "@/components/NewReminderForm";

export default async function NewReminderPage({ params }: { params: Promise<{
    teamId: string;
  }> }) {
  const { teamId } = await params;
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-6">New reminder</h1>
      <NewReminderForm teamId={teamId} />
    </div>
  );
}
