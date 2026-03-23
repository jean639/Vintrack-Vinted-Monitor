import { Metadata } from "next";
import { LikedClient } from "./client";

export const metadata: Metadata = {
  title: "Liked Items | Vintrack",
  description: "View and manage your liked Vinted items.",
};

export default function LikedPage() {
  return <LikedClient />;
}
