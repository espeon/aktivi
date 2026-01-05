import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldContent,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { z } from "zod";
import { useState } from "react";

export const Route = createFileRoute("/events_/create")({
  component: CreateEventPage,
});

const eventFormSchema = z.object({
  name: z
    .string()
    .min(1, "event name is required")
    .min(3, "event name must be at least 3 characters"),
  description: z.string().optional(),
  startsAt: z.string().min(1, "start time is required"),
  endsAt: z.string().optional(),
  mode: z.enum(["inperson", "virtual", "hybrid"]),
  status: z.enum([
    "planned",
    "scheduled",
    "rescheduled",
    "cancelled",
    "postponed",
  ]),
});

type CreateEventFormData = z.infer<typeof eventFormSchema>;

function CreateEventPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      startsAt: "",
      endsAt: "",
      mode: "inperson" as const,
      status: "planned" as const,
    },
    validators: {
      onChange: eventFormSchema.parse,
      onSubmit: eventFormSchema.parse,
    },
    onSubmit: async ({ value }: { value: CreateEventFormData }) => {
      setIsSubmitting(true);
      try {
        // TODO: submit to backend
        console.log("submitting event:", value);
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <div className="min-h-screen h-full min-w-full flex flex-col items-center bg-background px-4">
      <div className="container py-12 max-w-4xl">
        <Link
          to="/events"
          className="mb-8 flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft size={20} />
          back to events
        </Link>

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            create an event
          </h1>
          <p className="text-xl text-muted-foreground">
            share something happening in the Atmosphere
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-8"
          >
            <FieldGroup>
              {/* event name */}
              <form.Field
                name="name"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldContent>
                        <FieldLabel htmlFor={field.name}>event name</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="text"
                          placeholder="what's happening?"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                      </FieldContent>
                    </Field>
                  );
                }}
              />

              {/* description */}
              <form.Field
                name="description"
                children={(field) => (
                  <Field>
                    <FieldContent>
                      <FieldLabel htmlFor={field.name}>description</FieldLabel>
                      <Textarea
                        id={field.name}
                        name={field.name}
                        placeholder="tell us more about it..."
                        rows={4}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      <FieldDescription>
                        optional description of the event
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                )}
              />

              {/* mode */}
              <form.Field
                name="mode"
                children={(field) => (
                  <Field>
                    <FieldContent>
                      <FieldLabel htmlFor={field.name}>event type</FieldLabel>
                      <select
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onChange={(e) =>
                          field.handleChange(e.target.value as any)
                        }
                        onBlur={field.handleBlur}
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="inperson">in-person</option>
                        <option value="virtual">virtual</option>
                        <option value="hybrid">hybrid</option>
                      </select>
                    </FieldContent>
                  </Field>
                )}
              />

              {/* starts at */}
              <form.Field
                name="startsAt"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldContent>
                        <FieldLabel htmlFor={field.name}>starts at</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="datetime-local"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                      </FieldContent>
                    </Field>
                  );
                }}
              />

              {/* ends at */}
              <form.Field
                name="endsAt"
                children={(field) => (
                  <Field>
                    <FieldContent>
                      <FieldLabel htmlFor={field.name}>ends at</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="datetime-local"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      <FieldDescription>
                        optional, leave blank if same day
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                )}
              />

              {/* status */}
              <form.Field
                name="status"
                children={(field) => (
                  <Field>
                    <FieldContent>
                      <FieldLabel htmlFor={field.name}>status</FieldLabel>
                      <select
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onChange={(e) =>
                          field.handleChange(e.target.value as any)
                        }
                        onBlur={field.handleBlur}
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="planned">planned</option>
                        <option value="scheduled">scheduled</option>
                        <option value="rescheduled">rescheduled</option>
                        <option value="cancelled">cancelled</option>
                        <option value="postponed">postponed</option>
                      </select>
                    </FieldContent>
                  </Field>
                )}
              />
            </FieldGroup>

            {/* submit button */}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "creating..." : "create event"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
