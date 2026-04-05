import { Metadata } from "next";
import { YourListingsClient } from "./client";

export const metadata: Metadata = {
  title: "Your Listings | Vintrack",
  description: "Manage your own Vinted listings and their performance.",
};

export default function YourListingsPage() {
  return <YourListingsClient />;
}
