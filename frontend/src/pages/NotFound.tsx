import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="surface-card px-10 py-12 text-center">
        <p className="label-eyebrow mb-3">Bino Foundry</p>
        <h1 className="type-h1 mb-4 text-primary">404</h1>
        <p className="type-body-lg mb-6 font-light text-muted-foreground">This page could not be found.</p>
        <Link to="/bracelet" className="type-nav text-primary underline-offset-4 hover:underline">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
