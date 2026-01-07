import Link from "next/link";
import Image from "next/image";

import { Command } from "lucide-react";

import { LoginForm } from "../../_components/login-form";

export default function LoginV1() {
  return (
    <div className="flex h-dvh">
      <div className="bg-primary hidden lg:block lg:w-1/3">
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-primary-foreground text-5xl font-light">Welcome back</h1>
              <p className="text-primary-foreground/80 text-xl">Let's get to work</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-background flex w-full items-center justify-center p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Image src="/icon.png" alt="TeaOS" width={40} height={40} className="rounded-md" />
              <h1 className="text-4xl" style={{ fontFamily: 'Museo Moderno, sans-serif', fontWeight: 700 }}>TEAos.</h1>
            </div>
            <div className="font-medium tracking-tight">Login</div>
            <div className="text-muted-foreground mx-auto max-w-xl">
              Welcome back. Enter your email and password, let&apos;s hope you remember them this time.
            </div>
          </div>
          <div className="space-y-4">
            <LoginForm />
            <p className="text-muted-foreground text-center text-xs">
              Don&apos;t have an account?{" "}
              <Link href="register" className="text-primary">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
