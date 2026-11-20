import { BoardView } from "@/components/BoardView";
import { loadBoard } from "@/lib/board";

export const dynamic = "force-dynamic";

export default async function Home() {
  const board = await loadBoard();
  return <BoardView board={board} />;
}
