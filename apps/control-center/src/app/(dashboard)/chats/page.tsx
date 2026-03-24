import { Metadata } from "next";
import { ChatsClient } from "./client";

export const metadata: Metadata = {
  title: "Chats | Vintrack",
  description: "View your linked Vinted chats and reply directly from Vintrack.",
};

export default function ChatsPage() {
  return <ChatsClient />;
}
