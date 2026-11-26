import { BadgeCheck } from "lucide-react";
export default function VerifiedBadge({ verified = false, size = 16 }) {
  if (!verified) return null;
  return <span title="Verified account" aria-label="Verified account" style={{display:"inline-flex",verticalAlign:"middle",marginInlineStart:4,color:"#3698f5",lineHeight:0}}><BadgeCheck size={size} strokeWidth={2.8} /></span>;
}
