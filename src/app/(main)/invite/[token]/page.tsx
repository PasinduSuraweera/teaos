import { InviteAccept } from "./_components/invite-accept"

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params
  return <InviteAccept token={token} />
}
