import Sidebar from './Sidebar.jsx'
import MobileNav from './MobileNav.jsx'
import HelpDesk from './HelpDesk.jsx'

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-base-950">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>
      <MobileNav />
      <HelpDesk />
    </div>
  )
}
