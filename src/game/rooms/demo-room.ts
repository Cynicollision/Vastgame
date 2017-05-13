import { Room } from './../../engine/vastgame';
import { Guy } from './../actors/guy';

export const demoRoom = Room.define();

demoRoom.onStart(() => {
    demoRoom.createActor(Guy);
    demoRoom.createActor(Guy);
    demoRoom.createActor(Guy, 25, 100);
});