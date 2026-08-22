"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";

export function BrandLogo({
  size,
  className,
  priority,
}: {
  size: number;
  className?: string;
  priority?: boolean;
}) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- required hydration guard for next-themes
    setMounted(true);
  }, []);

  const isDark = mounted && theme !== "light";
  const src = isDark ? "/vila-corada-logo-dark.png" : "/vila-corada-logo.png";

  return (
    <Image
      src={src}
      alt="Vila Corada"
      width={size}
      height={size}
      priority={priority}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
