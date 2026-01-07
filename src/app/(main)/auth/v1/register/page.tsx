import Link from "next/link";
import Image from "next/image";

import { Command } from "lucide-react";

import { RegisterForm } from "../../_components/register-form";

export default function RegisterV1() {
  return (
    <div className="flex h-dvh">
      <div className="bg-background flex w-full items-center justify-center p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Image src="/icon.png" alt="TeaOS" width={40} height={40} className="rounded-md" />
              <h1 className="text-4xl" style={{ fontFamily: 'Museo Moderno, sans-serif', fontWeight: 700 }}>TEAos.</h1>
            </div>
            <div className="font-medium tracking-tight">Register</div>
            <div className="text-muted-foreground mx-auto max-w-xl">
              Fill in your details below. We promise not to quiz you about your first pet&apos;s name (this time).
            </div>
          </div>
          <div className="space-y-4">
            <RegisterForm />
            <p className="text-muted-foreground text-center text-xs">
              Already have an account?{" "}
              <Link href="login" className="text-primary">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-primary hidden lg:block lg:w-1/3">
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-primary-foreground text-5xl font-light">Your tea journey begins</h1>
              <p className="text-primary-foreground/80 text-xl">Cultivate success, one leaf at a time</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
