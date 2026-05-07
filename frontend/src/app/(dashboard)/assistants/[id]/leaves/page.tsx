"use client";
import { redirect } from "next/navigation";
import { use } from "react";
export default function LeavesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  redirect(`/assistants/${id}`);
}
