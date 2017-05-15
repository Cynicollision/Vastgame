import { Actor } from './actor';
import { ActorInstance } from './actor-instance';
import { GameLifecycleCallback } from './vastgame';

export class Room {

    private static nextActorInstanceID = (() => {
        let currentID = 0;
        return (() => ++currentID);
    })();

    static define(): Room {
        return new Room();
    }

    private readonly actorInstanceMap = new Map<number, ActorInstance>();

    start: GameLifecycleCallback;

    onStart(start: GameLifecycleCallback): void {
        this.start = start;
    }

    step(): void {
        let calledHandlers: Actor[] = [];

        this.getInstances().forEach(instance => {
            let parent = instance.parent;

            if (instance.isActive) {
                // apply actor movement
                if (instance.speed !== 0) {
                    instance.doMovement();
                }

                // call collision handlers
                if (!calledHandlers.some(handler => handler === parent)) {
                    this.checkCollisions(instance);
                }

                // call actor 'step' callbacks
                if (instance._onStep) {
                    instance._onStep(instance);
                }
            }
            else {
                // destroy instance
                parent.destroyInstance(instance.id);
                this.actorInstanceMap.delete(instance.id);
            }
        });
    }

    private checkCollisions(selfInstance: ActorInstance): void {
        
        Array.from(selfInstance.parent.collisionHandlers.entries()).forEach(kvp => {
            let [otherActor, callback] = kvp;

            otherActor.instanceMap.forEach(other => {
                if (selfInstance !== other && selfInstance.collidesWith(other)) {
                    callback(selfInstance, other);
                }
            });
        });
    }

    createActor(actorConfig: Actor, x?: number, y?: number): ActorInstance {
        let newActorInstanceID = Room.nextActorInstanceID();
        let newInstance: ActorInstance = actorConfig.createInstance(newActorInstanceID);
        newInstance.x = x || 0;
        newInstance.y = y || 0;

        this.actorInstanceMap.set(newActorInstanceID, newInstance);

        return newInstance;
    }

    getInstances(): ActorInstance[] {
        return Array.from(this.actorInstanceMap.values());
    }
}
