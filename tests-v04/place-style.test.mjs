import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryOf,ratingTone,CATEGORIES} from '../public/assets/place-style.v0.7.js';
test('eight categories preserve exact labels and normalize legacy ones',()=>{assert.deepEqual(CATEGORIES,['修道院','教堂','墓地','城堡','宫殿','城市','博物馆','展览']);for(const c of CATEGORIES)assert.equal(categoryOf(c),c);assert.equal(categoryOf('美术馆'),'博物馆');assert.equal(categoryOf('城堡与桥梁'),'城堡');assert.equal(categoryOf('其他','fountains-abbey'),'修道院');assert.equal(categoryOf(undefined),'未分类');});
test('rating tones preserve zero, half-star boundaries and unrated distinction',()=>{for(const [v,tone] of [[null,'unrated'],[undefined,'unrated'],['5','unrated'],[0,'clay'],[1.5,'clay'],[2,'ochre'],[3,'ochre'],[3.5,'sage'],[4,'sage'],[4.5,'forest'],[5,'forest']])assert.equal(ratingTone(v),tone);});
