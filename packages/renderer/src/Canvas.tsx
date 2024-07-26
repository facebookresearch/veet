/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @jsxRuntime classic */
/** @jsx q */
import { Color4, Engine, Scene } from '@babylonjs/core';
import { q } from 'quark-styles'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { Component, createRef } from 'react';


type CanvasProps = {
  width: number;
  height: number;
  clearColor?: [number, number, number, number];
}

export class Canvas extends Component<CanvasProps> {
  protected canvasRef = createRef<HTMLCanvasElement>();
  private engine: Engine | null = null;
  protected renderScene: Scene | null = null;

  engineRender = () => {
    this.renderScene?.render();
  };

  engineSetup() {
    if (!this.engine) {
      this.engine = new Engine(this.canvasRef.current, true);
      this.engine.runRenderLoop(this.engineRender);
    }


    const renderScene = this.renderScene = new Scene(this.engine);
    const clearColor: [number, number, number, number] = this.props.clearColor || [1.0, 1.0, 1.0, 1.0];
    renderScene.clearColor = new Color4(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
  }

  componentDidMount() {
    if (this.canvasRef.current == null) {
        console.error('IMUScene: canvasRef is null');
      return;
    }
    this.engineSetup();
  }

  componentWillUnmount() {
    if (this.engine) {
      this.renderScene = null;

      this.engine.dispose();
      this.engine = null;
    }
  }

  render() {
    return (
      <canvas ref={this.canvasRef} width={this.props.width} height={this.props.height} />
    );
  }
}
