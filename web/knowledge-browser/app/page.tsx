import type { Metadata } from "next";
import { KnowledgeBrowser } from "./KnowledgeBrowser";

export const metadata: Metadata = {
  title: "Rho Knowledge Library",
  description: "Browse and search the τ-bench banking knowledge base.",
};

export default function Home() {
  return <KnowledgeBrowser />;
}
