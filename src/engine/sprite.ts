import { SpriteAnimation } from './sprite-animation';
import { Vastgame } from './vastgame';
import { GameCanvasContext } from './canvas';

export interface SpriteOptions {
    imageSource: string;
    height: number;
    width: number;
    frameBorder?: number;
}

export interface DrawSpriteOptions {
    frame?: number;
    opacity?: number;
    tileX?: boolean;
    tileY?: boolean;
}

export class Sprite {
    
    static define(name: string, options: SpriteOptions): Sprite {
        let sprite = new Sprite(options);
        Vastgame._getContext().defineSprite(name, sprite);

        return sprite;
    }

    static get(name: string): Sprite {
        return Vastgame._getContext().getSprite(name);
    }

    draw(canvasContext: GameCanvasContext, x: number, y: number, options: DrawSpriteOptions = {}): void {
        this.defaultAnimation.setFrame(options.frame || 0);
        this.defaultAnimation.draw(canvasContext, x, y, options);
    }

    readonly image: HTMLImageElement;
    readonly height: number;
    readonly width: number;
    readonly frameBorder: number;
    readonly defaultAnimation: SpriteAnimation;

    constructor(options: SpriteOptions) {
        this.image = new Image();
        this.image.src = options.imageSource;
        this.height = options.height;
        this.width = options.width;
        this.frameBorder = options.frameBorder;
        this.defaultAnimation = new SpriteAnimation(this);
    }

    getFrameImageSourceCoords(frame: number): [number, number] {
        let frameBorder = this.frameBorder || 0;
        let frameRow = 0;

        if (this.image.width) {
            let framesPerRow = Math.floor(this.image.width / this.width);
            while (this.width * frame >= framesPerRow * this.width) {
                frame -= framesPerRow;
                frameRow++;
            }
        }

        let frameXOffset = frame * frameBorder;
        let frameYOffset = frameRow * frameBorder;
        let srcX = frame * this.width + frameXOffset;
        let srcY = frameRow * this.height + frameYOffset;

        return [srcX, srcY];
    }
}
