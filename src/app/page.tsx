import { TaskBoard } from "@/components/task-board";

/** Client-Board; Seite selbst bleibt Server-Component. */
export default function Home() {
  return (
    <main className="h-screen min-h-0 overflow-hidden">
      <TaskBoard />
    </main>
  );
}
