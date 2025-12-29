import { Link } from "@tanstack/react-router";

export default function Footer() {
  return (
    <>
      <footer className="w-full px-4 flex items-center justify-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container py-32 grid lg:grid-cols-2 space-y-8">
          <div className="flex items-start gap-6 flex-1">
            <Link to="/" className="text-xl">
              <span className="font-semibold">aktivi</span> by teal computing
            </Link>
          </div>
          <div className="grid lg:grid-cols-2 gap-6 flex-1">
            <div>
              <p className="font-semibold">App</p>
              <ul className="mt-2 space-y-2">
                <li>
                  <Link to="/" className="hover:underline">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/events" className="hover:underline">
                    Events
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold">Legal</p>
              <ul className="mt-2 space-y-2">
                <li>
                  <Link
                    to="/legal/content-guidelines"
                    className="hover:underline"
                  >
                    Content Guidelines
                  </Link>
                </li>
                <li>
                  <Link to="/legal/privacy-policy" className="hover:underline">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/legal/tos" className="hover:underline">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-full h-full overflow-clip flex flex-col items-center -z-10">
          <div className="text-[50vh] h-auto overflow-clip opacity-20">
            AKTIVI
          </div>
        </div>
      </footer>
    </>
  );
}
