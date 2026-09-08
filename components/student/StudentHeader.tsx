import LogoutButton from "@/components/auth/LogoutButton";
import Brand from "@/components/Brand";

export default function StudentHeader({ username }: { username: string }) {
  return <header className="topbar"><div className="container between"><Brand href="/courses" /><div className="row"><span className="subtle">{username}</span><LogoutButton /></div></div></header>;
}
