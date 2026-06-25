import type { ReactNode } from "react";
import { Circle, MousePointer2, PenLine, Pentagon, RectangleHorizontal, Sparkles, Star, Type } from "lucide-react";
import { IconButton } from "./ui";

export type AddLayerKind = "rect" | "ellipse" | "polygon" | "star" | "line" | "text";
export type EditorTool = "select" | AddLayerKind;

interface ToolbarProps {
  activeTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  onAddLayer: (kind: AddLayerKind) => void;
}

const tools: Array<{ tool: EditorTool; label: string; icon: ReactNode; add?: AddLayerKind }> = [
  { tool: "select", label: "Select", icon: <MousePointer2 size={18} strokeWidth={2} /> },
  { tool: "rect", label: "Rectangle", icon: <RectangleHorizontal size={18} strokeWidth={2} />, add: "rect" },
  { tool: "ellipse", label: "Ellipse", icon: <Circle size={18} strokeWidth={2} />, add: "ellipse" },
  { tool: "polygon", label: "Polygon", icon: <Pentagon size={18} strokeWidth={2} />, add: "polygon" },
  { tool: "star", label: "Star", icon: <Star size={18} strokeWidth={2} />, add: "star" },
  { tool: "line", label: "Line", icon: <PenLine size={18} strokeWidth={2} />, add: "line" },
  { tool: "text", label: "Text", icon: <Type size={18} strokeWidth={2} />, add: "text" },
];

export function Toolbar({ activeTool, onSelectTool, onAddLayer }: ToolbarProps) {
  return (
    <nav className="toolbar" aria-label="Shape tools">
      <div className="toolbar-group" role="group" aria-label="Tools">
        {tools.map((tool) => (
          <IconButton
            key={tool.tool}
            label={tool.label}
            icon={tool.tool === "star" ? <Sparkles size={18} strokeWidth={2} /> : tool.icon}
            pressed={activeTool === tool.tool}
            onClick={() => {
              onSelectTool(tool.tool);

              if (tool.add) {
                onAddLayer(tool.add);
              }
            }}
          />
        ))}
      </div>
    </nav>
  );
}
