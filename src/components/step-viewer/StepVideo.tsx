"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Play, CheckCircle2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { resolveVideoEmbed, type VideoEmbed } from "@/lib/video-embed";
import type { Locale } from "@/lib/store";
import type { StepComponentProps } from "./StepTypes";

function VideoPlayer({ embed, locale }: { embed: VideoEmbed; locale: string }) {
  if (embed.kind === "iframe") {
    return (
      <iframe
        src={embed.src}
        className="w-full h-full"
        allowFullScreen
        allow="autoplay; encrypted-media; fullscreen"
        title="Video lesson"
      />
    );
  }

  if (embed.kind === "file") {
    return (
      <video
        src={embed.src}
        controls
        className="w-full h-full"
        preload="metadata"
        playsInline
      >
        <track default kind="captions" srcLang="ru" label="Russian" />
      </video>
    );
  }

  if (embed.kind === "external") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white gap-3">
        <a
          href={embed.src}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          {t("course.step.videoLesson", locale as Locale)}
        </a>
        <p className="text-sm opacity-50 text-center max-w-sm break-all">{embed.src}</p>
      </div>
    );
  }

  return null;
}

export function StepVideo({ step, locale }: StepComponentProps) {
  const embed = resolveVideoEmbed(step.videoUrl);

  return (
    <Card className="border-0 shadow-sm mb-6 overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-gray-900 aspect-video flex items-center justify-center relative group">
          {embed.kind !== "none" ? (
            <VideoPlayer embed={embed} locale={locale} />
          ) : (
            <div className="text-center text-white">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white/20 transition-colors cursor-pointer">
                <Play className="w-10 h-10 ml-1" />
              </div>
              <p className="text-lg font-medium mb-1">{t("course.step.videoLesson", locale)}</p>
              <p className="text-sm opacity-50">{t("course.step.clickToPlay", locale)}</p>
            </div>
          )}
          {step.completed && (
            <div className="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {t("course.step.watched", locale)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
