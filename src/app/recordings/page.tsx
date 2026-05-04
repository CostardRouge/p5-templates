import type {
  Metadata
} from "next";
import RecordingsPage from "@/components/RecordingsPage/RecordingsPage";

export const metadata: Metadata = {
  title: "Recordings",
  description:
    "View and manage your recorded social media videos and images. Download, preview, and share your generated content.",
  alternates: {
    canonical: "/recordings"
  },
  robots: {
    index: false,
    follow: true
  }
};

export default RecordingsPage;
