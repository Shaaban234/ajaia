import { avatarColor, initials } from "@/lib/ui";

export default function Avatar({ name, id, size, title }: { name: string; id: string; size?: "lg"; title?: string }) {
  return (
    <span className={`avatar ${size === "lg" ? "avatar-lg" : ""}`} style={{ background: avatarColor(id) }} title={title ?? name} aria-hidden={!title}>
      {initials(name)}
    </span>
  );
}
