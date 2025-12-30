import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import Header from "../components/Header";
import Footer from "@/components/footer";
import Providers from "@/components/providers";

export const Route = createRootRoute({
  component: () => (
    <Providers>
      <Header />
      <div className="animate-in fade-in duration-200">
        <Outlet />
      </div>
      <TanStackDevtools
        config={{
          position: "bottom-right",
        }}
        plugins={[
          {
            name: "Tanstack Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
      <Footer />
    </Providers>
  ),
});
