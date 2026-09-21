import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryOf,ratingTone,CATEGORIES} from '../public/assets/place-style.v0.6.js';
test('five core category icons plus fallback preserve special location types',()=>{for(const c of CATEGORIES)assert.equal(categoryOf(c),c);assert.equal(categoryOf('宫殿'),'城堡');assert.equal(categoryOf('城堡与桥梁'),'城堡');assert.equal(categoryOf('展览'),'博物馆');assert.equal(categoryOf('墓地'),'其他');assert.equal(categoryOf(undefined),'其他');});
test('rating tones preserve zero, half-star boundaries and unrated distinction',()=>{for(const [v,tone] of [[null,'unrated'],[undefined,'unrated'],['5','unrated'],[0,'clay'],[1.5,'clay'],[2,'ochre'],[3,'ochre'],[3.5,'sage'],[4,'sage'],[4.5,'forest'],[5,'forest']])assert.equal(ratingTone(v),tone);});
