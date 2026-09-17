import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PreInterviewFormProps {
  onSubmit: (data: { name: string; phone: string }) => Promise<void>;
}

export function PreInterviewForm({ onSubmit }: PreInterviewFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Pure validation functions (no side effects)
  const isNameValid = (value: string): boolean => {
    return value.trim().length >= 2;
  };

  const isPhoneValid = (value: string): boolean => {
    const digitsOnly = value.replace(/\D/g, "");
    const validChars = /^[\d\s\+\(\)\-]+$/;
    return validChars.test(value) && digitsOnly.length >= 7 && digitsOnly.length <= 15;
  };

  // Validation functions with side effects (for blur/submit)
  const validateName = (value: string): boolean => {
    const isValid = isNameValid(value);
    if (!isValid) {
      setNameError("Please enter at least 2 characters.");
    } else {
      setNameError("");
    }
    return isValid;
  };

  const validatePhone = (value: string): boolean => {
    const isValid = isPhoneValid(value);
    if (!isValid) {
      setPhoneError("That doesn't look like a valid phone. Try including the country code.");
    } else {
      setPhoneError("");
    }
    return isValid;
  };

  const handleNameBlur = () => {
    setNameTouched(true);
    validateName(name);
  };

  const handlePhoneBlur = () => {
    setPhoneTouched(true);
    validatePhone(phone);
  };

  // Pure function for checking if form can be submitted
  const isFormValid = (): boolean => {
    return isNameValid(name) && isPhoneValid(phone);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    setPhoneTouched(true);
    setSubmitError("");

    const nameValid = validateName(name);
    const phoneValid = validatePhone(phone);

    if (!nameValid || !phoneValid) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), phone: phone.trim() });
    } catch (error) {
      setSubmitError("We couldn't save your details just now. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Before we begin</CardTitle>
        </CardHeader>
        <CardContent>
          {submitError && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <p className="text-muted-foreground mb-6">
            Please pop in your name and a phone number. This lets us greet you properly and follow up if needed.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g., Maya Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleNameBlur}
                  aria-invalid={nameTouched && !!nameError}
                  aria-describedby={nameError ? "name-error" : undefined}
                  disabled={isSubmitting}
                  className="h-12"
                />
                {nameTouched && nameError && (
                  <p id="name-error" className="text-sm text-destructive">
                    {nameError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="e.g., +44 7123 456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={handlePhoneBlur}
                  aria-invalid={phoneTouched && !!phoneError}
                  aria-describedby={phoneError ? "phone-error" : "phone-help"}
                  disabled={isSubmitting}
                  className="h-12"
                />
                <p id="phone-help" className="text-xs text-muted-foreground">
                  Include your country code if you can.
                </p>
                {phoneTouched && phoneError && (
                  <p id="phone-error" className="text-sm text-destructive">
                    {phoneError}
                  </p>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-6">
              We'll only use these details for this interview.
            </p>

            <div className="flex justify-end">
              <div className="space-y-1">
                <Button
                  type="submit"
                  size="lg"
                  disabled={!isFormValid() || isSubmitting}
                  className="min-w-[180px]"
                >
                  {isSubmitting ? "Starting…" : "Start interview"}
                </Button>
                {!isFormValid() && !isSubmitting && (
                  <p className="text-xs text-muted-foreground text-right">
                    Enter your name and a valid phone to start.
                  </p>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
