import { redirect } from "next/navigation";

export default function EnvIndex({ params }: { params: { org: string; env: string } }) {
  redirect(`/${params.org}/${params.env}/overview`);
}
