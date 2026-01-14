import { Rect, Paint } from "@shopify/react-native-skia";
import { useDerivedValue } from 'react-native-reanimated';

// Передаем SharedValue целиком
export const SelectionRect = ({ selectionSV }) => {
    const rectPath = useDerivedValue(() => {
        const { x1, y1, x2, y2, active } = selectionSV.value;
        
        if (!active) return { x: 0, y: 0, width: 0, height: 0 };
        
        return {
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.max(0.1, Math.abs(x2 - x1)),
            height: Math.max(0.1, Math.abs(y2 - y1)),
        };
    });

    return (
        <Rect rect={rectPath} color="rgba(0, 120, 255, 0.3)">
            <Paint color="#0078ff" style="stroke" strokeWidth={2} />
        </Rect>
    );
};
