import { createFileRoute } from "@tanstack/react-router";
import { DeliveryPage } from "@/components/pages/delivery";

export const Route = createFileRoute("/static-delivery")({ component: DeliveryPage });
