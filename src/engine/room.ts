import { Actor } from './actor';
import { ActorInstance } from './actor-instance';
import { GameCanvasContext } from './canvas';
import { Key } from './enum';
import { EventHandler, Input, PointerInputEvent } from './input';
import { DrawSpriteOptions, Sprite } from './sprite';
import { Vastgame } from './vastgame';
import { ActorID } from '../game/util/enum';

interface RoomLifecycleCallback {
    (selfInstance: Room, args?: any): void;
}

interface RoomLifecycleDrawCallback {
    (selfInstance: Room, context: GameCanvasContext, args?: any): void;
}

export class Background {

    constructor(
        readonly color: string,
        readonly canvasColor: string = '#000', 
        readonly width: number, 
        readonly height: number) {
    }
}

export interface RoomBehavior {
    preHandleClick: (event: PointerInputEvent) => void;
    postHandleClick: (event: PointerInputEvent) => void;
    postStep: RoomLifecycleCallback;
    preDraw: RoomLifecycleDrawCallback;
}

export class Room {
    
    private static nextActorInstanceID = (() => {
        let currentID = 0;
        return (() => ++currentID);
    })();

    static define(name: string): Room {
        let room = new Room(name);
        Vastgame._getContext().defineRoom(name, room);
        return room;
    }

    static get(name: string): Room {
        return Vastgame._getContext().getRoom(name);
    }

    private actorInstanceMap: { [index: number]: ActorInstance } = {};
    private propertyMap: { [index: string]: any } = {};
    private behaviors: RoomBehavior[] = [];
    private eventHandlers: EventHandler[] = [];
    private onStartCallback: RoomLifecycleCallback;
    private onDrawCallback: RoomLifecycleDrawCallback;
    
    background: Background;

    constructor(private name: string) {
    }

    set(propertyName: string, value: any): void {
        this.propertyMap[propertyName] = value;
    }

    get(propertyName: string): any {
        return this.propertyMap[propertyName];
    }

    setBackground(color: string, width: number, height: number, pageColor?: string): void {
        this.background = new Background(color, pageColor, width, height);
    }

    end(): void {
        this.actorInstanceMap = {};
        this.behaviors = [];
        this.eventHandlers.forEach(eventHandler => eventHandler.sleep());
    }

    // mix-in behaviors
    use(behavior: RoomBehavior): RoomBehavior {
        this.behaviors.push(behavior);
        return behavior;
    }

    // lifecycle callbacks
    onStart(callback: RoomLifecycleCallback): Room {
        this.onStartCallback = callback;
        return this;
    }

    _callStart(args?: any): void {
        this.eventHandlers.forEach(eventHandler => eventHandler.wake());
        
        if (this.onStartCallback) {
            try {
                this.onStartCallback(this, args);
            }
            catch (error) {
                throw `Room: ${this.name}.start: ` + error;
            }
        }
    }

    onDraw(callback: RoomLifecycleCallback): Room {
        this.onDrawCallback = callback;
        return this;
    }

    _callDraw(args?: any): void {
        if (this.onDrawCallback) {
            let canvasContext = Vastgame._getContext().getCanvasContext();

            try {
                this.onDrawCallback(this, canvasContext, args);
            }
            catch (error) {
                throw  `Room: ${this.name}.draw: ` + error;
            }
        }
    }

    // event callbacks
    onClick(callback: (self: Room, event: PointerInputEvent) => void): Room {
        let room = this;
        let clickHandler = Input.registerClickHandler(function (event) {
            if (Vastgame._getContext().getCurrentRoom() === room) {
                callback(room, event);
            }
        });
        this.eventHandlers.push(clickHandler);
        return this;
    }

    onKey(key: Key, callback: (self: Room, event: KeyboardEvent) => void): Room {
        let room = this;
        let keyHandler = Input.registerKeyHandler(key, function (event) {
            if (Vastgame._getContext().getCurrentRoom() === room) {
                callback(room, event);
            }
        });
        this.eventHandlers.push(keyHandler);
        return this;
    }

    // step behavior
    step(): void {

        this.getInstances().forEach(instance => {
            let parent = instance.parent;

            if (instance.isActive) {
                instance._applyMovement();

                this.checkCollisions(instance);

                parent._callStep(instance);
            }
            else {
                instance.parent._callDestroy(instance);
                delete this.actorInstanceMap[instance.id];
            }
        });

        this.behaviors.forEach(behavior => behavior.postStep(this));
    }

    private checkCollisions(selfInstance: ActorInstance): void {
        let parent = selfInstance.parent;
        
        for (let actorName in parent.collisionHandlers) {

            try {
                let callback = parent.collisionHandlers[actorName];
                let otherActor = Actor.get(actorName);
    
                for (let otherID in this.actorInstanceMap) {
                    let other = this.actorInstanceMap[otherID];
    
                    if (other.parent === otherActor) {
    
                        if (selfInstance !== other && selfInstance.collidesWith(other)) {
                            callback(selfInstance, other);
                        }
                    }
                }
            }
            catch (error) {
                throw `Actor: ${this.name}[${selfInstance.id}].collision(${actorName}): ` + error;
            }
        };
    }

    // draw behavior
    draw(canvasContext: GameCanvasContext): void {
        // call pre-draw behaviors
        this.behaviors.forEach(behavior => behavior.preDraw(this, canvasContext));

        // draw room background
        if (this.background) {
            canvasContext.fillArea(-this.background.width, -this.background.height, this.background.width * 3, this.background.height * 3, this.background.canvasColor);
            canvasContext.fill(this.background.width, this.background.height, this.background.color);
        }

        let orderedInstances = this.getInstances().sort((a, b) => {
            return (b.animation ? b.animation.depth : 0) - (a.animation ? a.animation.depth : 0);
        });

        orderedInstances.forEach(instance => {
            // draw sprites
            if (instance.animation && instance.visible) {
                instance.animation.draw(canvasContext, instance.x, instance.y);
            }

            // call actor draw event callbacks
            instance.parent._callDraw(instance);
        });

        // call room draw event callback
        this._callDraw();
    }

    handleClick(event: PointerInputEvent): void {
        // call pre-click behaviors
        this.behaviors.forEach(behavior => behavior.preHandleClick(event));
        
        // pass click event to actor instances
        let clickX = event.x;
        let clickY = event.y;

        this.getInstancesAtPosition(clickX, clickY).forEach(instance => {
            let parent = instance.parent;

            if (instance.occupiesPosition(clickX, clickY)) {
                parent._callClick(instance, event);
            }
        });

        // call post-click behaviors
        this.behaviors.forEach(behavior => behavior.postHandleClick(event));
    }

    createActor(actorID: string, x?: number, y?: number): ActorInstance {
        let parentActor = Actor.get(actorID);

        let newActorInstanceID = Room.nextActorInstanceID();
        let newInstance = new ActorInstance(this, parentActor, newActorInstanceID, x, y);

        this.actorInstanceMap[newActorInstanceID] = newInstance;

        parentActor._callCreate(newInstance);

        return newInstance;
    }

    getInstance(actorType: Actor): ActorInstance {
        return this.getInstances([actorType])[0];
    }

    getInstances(actorTypes: Actor[] = []): ActorInstance[] {
        let instances = [];

        for (let instanceID in this.actorInstanceMap) {
            let instance = this.actorInstanceMap[instanceID]

            if (!actorTypes.length || (actorTypes && actorTypes.indexOf(instance.parent) > -1)) {
                instances.push(this.actorInstanceMap[instanceID]);
            }
        }

        return instances;
    }

    getInstancesAtPosition(x: number, y: number): ActorInstance[] {
        return this.getInstances().filter(instance => instance.occupiesPosition(x, y));
    }

    isPositionFree(x: number, y: number, actorTypes?: Actor[]): boolean {

        if (!actorTypes || !actorTypes.length) {
            return !this.getInstancesAtPosition(x, y).length;
        }

        return !this.getInstancesAtPosition(x, y)
            .filter(actorInstance => actorTypes.indexOf(actorInstance.parent) !== -1)
            .length;
    }
}
