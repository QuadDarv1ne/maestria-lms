"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Code2, Lightbulb, Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { StepComponentProps } from "./StepTypes";

export function StepCoding({ step, locale, submittingAssignment, onSubmitAssignment }: StepComponentProps) {
  const [codeValue, setCodeValue] = useState("");
  const [codeOutput, setCodeOutput] = useState("");
  const [codeSubmitted, setCodeSubmitted] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!codeValue.trim()) {
      toast.error(t("course.step.writeCodeFirst", locale));
      return;
    }
    const assignment = step.assignments?.[0];
    if (!assignment) return;
    const result = await onSubmitAssignment(assignment.id, codeValue);
    if (result) {
      setCodeSubmitted(true);
      setCodeOutput("// Execution result...\n> Hello, World!\n> Program completed successfully");
      toast.success(t("course.step.codeSent", locale));
    }
  }, [codeValue, step, onSubmitAssignment, locale]);

  return (
    <div className="space-y-4 mb-6">
      {step.content && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3 text-sm text-amber-600">
              <Lightbulb className="w-4 h-4" />
              <span className="font-medium">{t("course.step.theory", locale)}</span>
            </div>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">{step.content}</div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-gray-900 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-300 font-medium">{t("course.step.codeEditor", locale)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
        </div>
        <CardContent className="p-0">
          <Textarea
            className="font-mono text-sm bg-gray-900 text-green-400 border-0 rounded-none min-h-[200px] resize-y focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder={t("course.step.codePlaceholder", locale)}
            value={codeValue}
            onChange={(e) => setCodeValue(e.target.value)}
            disabled={codeSubmitted}
          />
        </CardContent>
      </Card>

      {codeSubmitted && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-gray-300 font-medium">{t("course.step.executionResult", locale)}</span>
            <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">
              {t("course.step.success", locale)}
            </Badge>
          </div>
          <CardContent className="p-0">
            <pre className="p-4 text-sm text-green-400 font-mono bg-gray-900 whitespace-pre-wrap">
              {codeOutput}
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button
          className="bg-amber-600 hover:bg-amber-700 text-white"
          onClick={handleSubmit}
          disabled={codeSubmitted || submittingAssignment}
        >
          <Send className="w-4 h-4 mr-2" />
          {codeSubmitted ? t("course.step.sent", locale) : t("course.step.submitCode", locale)}
        </Button>
        {codeSubmitted && (
          <Button variant="outline" onClick={() => { setCodeSubmitted(false); setCodeOutput(""); }}>
            <RotateCcw className="w-4 h-4 mr-2" />
            {t("course.step.tryAgain", locale)}
          </Button>
        )}
      </div>
    </div>
  );
}
