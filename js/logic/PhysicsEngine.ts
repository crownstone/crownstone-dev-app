import BarnesHutSolver                      from './physicsComponents/BarnesHutSolver';
import SpringSolver                         from './physicsComponents/SpringSolver';
import CentralGravitySolver                 from './physicsComponents/CentralGravitySolver';
import ForceAtlas2BasedRepulsionSolver      from './physicsComponents/FA2BasedRepulsionSolver';
import ForceAtlas2BasedCentralGravitySolver from './physicsComponents/FA2BasedCentralGravitySolver';
import MassMover from "./physicsComponents/MassMover";
import KamadaKawai from "./physicsComponents/KamadaKawai";
import { xUtil } from "../util/StandAloneUtil";

class PhysicsEngine {

  physicsBody : any;
  physicsEnabled : any;
  simulationInterval : any;
  requiresTimeout : any;
  previousStates  : any;
  referenceState  : any;
  freezeCache  : any;
  renderTimer  : any;
  adaptiveTimestep  : any;
  adaptiveTimestepEnabled  : any;
  adaptiveCounter : any;
  adaptiveInterval : any;
  stabilized  : any;
  startedStabilization  : any;
  stabilizationIterations  : any;
  ready : any;
  baseOptions : any;
  options  : any;
  timestep = 0.5;
  layoutFailed = false;

  nodesSolver: any;
  massMover: any;
  edgesSolver: any;
  gravitySolver: any;
  modelOptions: any;

  targetIterations: any;

  onChange: any;
  onStable: any;
  radius: any;
  height: number;
  width: number;

  usePhysics = true;

  constructor() {}

  initEngine(center, width, height, radius, onChange = () => {}, onStable = () => {}, usePhysics = true) {
    this.usePhysics = usePhysics;

    this.onChange = onChange;
    this.onStable = onStable;
    this.radius = radius;
    this.width = width;
    this.height = height;

    this.physicsBody = {nodes: [], edges: [], physicsNodeIndices:[], physicsEdgeIndices:[], forces: {}, velocities: {}, randomSeed:6, radius: this.radius, height: height, width: width};

    this.physicsEnabled = true;
    this.simulationInterval = 1000 / 60;
    this.requiresTimeout = true;
    this.previousStates = {};
    this.referenceState = {};
    this.freezeCache = {};
    this.renderTimer = undefined;

    // parameters for the adaptive timestep
    this.adaptiveTimestep = false;
    this.adaptiveTimestepEnabled = false;
    this.adaptiveCounter = 0;
    this.adaptiveInterval = 3;

    this.stabilized = false;
    this.startedStabilization = false;
    this.stabilizationIterations = 0;
    this.ready = false; // will be set to true if the stabilize

    // default options
    this.baseOptions = {
      enabled: true,
      barnesHut: {
        theta: 0.4,
        gravitationalConstant: -6000,
        centralGravity: 0.3,
        springLength: 50,
        springConstant: 0.02,
        damping: 0.09,
        avoidOverlap: 0
      },
      forceAtlas2Based: {
        theta: 0.5,
        gravitationalConstant: -100,
        centralGravity: 0.1,
        springConstant: 0.02,
        springLength: 100,
        damping: 0.4,
        avoidOverlap: 1
      },
      maxVelocity: 50,
      minVelocity: 0.75,    // px/s
      solver: 'forceAtlas2Based',
      stabilization: {
        enabled: true,
        iterations: 1000,   // maximum number of iteration to stabilize
        updateInterval: 50,
        onlyDynamicEdges: false,
        fit: true
      },
      timestep: 0.5,
      adaptiveTimestep: true,
      useLinearAttractors: true,
      useOverlapAvoidance: true,
      useDynamicEdges: true,
      center: center
    };
    this.options = xUtil.deepExtend({}, this.baseOptions);
    this.timestep = 0.5;
    this.layoutFailed = false;

    this.init();
  }

  setOptions(options) {
    if (options) {
      let baseOptions = xUtil.deepExtend({}, this.options);
      this.options = xUtil.deepExtend(baseOptions, options);
      this.init()
    }
  }

  clear() {
    this.onChange = () => {};
    this.onStable = () => {};
  }


  load(nodes : any, edges : any[] = []) {
    // inject ids into edges if they arent there yet.
    if (edges && Array.isArray(edges)) {
      for (let i = 0; i < edges.length; i++) {
        if (edges[i].id === undefined) {
          edges[i].id = "edge_" + i;
        }
        edges[i].connected = true;
        if (!nodes[edges[i].from] || !nodes[edges[i].to]) {
          edges[i].connected = false;
        }
      }
    }
    else {
      edges = [];
    }

    this.physicsBody.nodes = nodes;
    let nodeIds = Object.keys(nodes).sort();


    this.positionInitially(nodes, nodeIds);
    if (edges.length > 0) {
      let springLength = this.options[this.options.solver].springLength;
      if (this.usePhysics) {
        let layoutSolver = new KamadaKawai(
          nodes,
          edges,
          this.options.useDynamicEdges ? 2 * springLength : springLength,
          this.options[this.options.solver].springConstant
        );
        layoutSolver.solve();
      }

      if (this.options.useDynamicEdges === true) {
        for (let i = 0; i < edges.length; i++) {
          if (edges[i].connected) {
            let viaId = "edge_viaNode" + i;
            edges[i]._viaId = viaId;
            nodes[viaId] = {
              id: viaId,
              mass: 1,
              fixed: false,
              support: true,
              x: 0.5 * (nodes[edges[i].from].x + nodes[edges[i].to].x),
              y: 0.5 * (nodes[edges[i].from].y + nodes[edges[i].to].y)
            }
          }
        }
      }
    }

    nodeIds = Object.keys(nodes).sort();

    // this.onChange();

    // load edges into nodeModel
    nodeIds.forEach((nodeId) => {
      nodes[nodeId].edges = [];
      edges.forEach((edge) => {
        if (edge.from === nodeId || edge.to === nodeId && edge.from !== edge.to) {
          nodes[nodeId].edges.push(edge);
        }
      })
    });

    this.physicsBody.edges = edges;

    this.updatePhysicsData(nodeIds);
  }

  /**
   * configure the engine.
   */
  init() {
    let options;
    if (this.options.solver === 'forceAtlas2Based') {
      options = this.options.forceAtlas2Based;
      options['center'] = this.options.center;
      options['useOverlapAvoidance'] = this.options.useOverlapAvoidance;
      options['useLinearAttractors'] = this.options.useLinearAttractors;
      this.nodesSolver = new ForceAtlas2BasedRepulsionSolver(this.physicsBody, options);
      this.edgesSolver = new SpringSolver(this.physicsBody, options);
      this.gravitySolver = new ForceAtlas2BasedCentralGravitySolver(this.physicsBody, options);
      this.massMover = new MassMover(this.physicsBody, options);
    }
    else { // barnesHut
      options = this.options.barnesHut;
      options['center'] = this.options.center;
      options['useOverlapAvoidance'] = this.options.useOverlapAvoidance;
      options['useLinearAttractors'] = this.options.useLinearAttractors;
      this.nodesSolver = new BarnesHutSolver(this.physicsBody, options);
      this.edgesSolver = new SpringSolver(this.physicsBody, options);
      this.gravitySolver = new CentralGravitySolver(this.physicsBody, options);
      this.massMover = new MassMover(this.physicsBody, options);
    }

    this.modelOptions = options;
  }



  /**
   * A single simulation step (or 'tick') in the physics simulation
   *
   * @private
   */
  physicsTick() {
    // this is here to ensure that there is no start event when the network is already stable.
    if (this.startedStabilization === false) {
      this.startedStabilization = true;
    }

    if (this.stabilized === false) {
      // adaptivity means the timestep adapts to the situation, only applicable for stabilization
      if (this.adaptiveTimestep === true && this.adaptiveTimestepEnabled === true) {
        // this is the factor for increasing the timestep on success.
        let factor = 1.2;

        // we assume the adaptive interval is
        if (this.adaptiveCounter % this.adaptiveInterval === 0) { // we leave the timestep stable for "interval" iterations.
          // first the big step and revert. Revert saves the reference state.
          this.timestep = 2 * this.timestep;
          this.calculateForces();
          this.moveNodes();
          this.revert();

          // now the normal step. Since this is the last step, it is the more stable one and we will take this.
          this.timestep = 0.5 * this.timestep;

          // since it's half the step, we do it twice.
          this.calculateForces();
          this.moveNodes();
          this.calculateForces();
          this.moveNodes();

          // we compare the two steps. if it is acceptable we double the step.
          if (this._evaluateStepQuality() === true) {
            this.timestep = factor * this.timestep;
          }
          else {
            // if not, we decrease the step to a minimum of the options timestep.
            // if the decreased timestep is smaller than the options step, we do not reset the counter
            // we assume that the options timestep is stable enough.
            if (this.timestep/factor < this.options.timestep) {
              this.timestep = this.options.timestep;
            }
            else {
              // if the timestep was larger than 2 times the option one we check the adaptivity again to ensure
              // that large instabilities do not form.
              this.adaptiveCounter = -1; // check again next iteration
              this.timestep = Math.max(this.options.timestep, this.timestep/factor);
            }
          }
        }
        else {
          // normal step, keeping timestep constant
          this.calculateForces();
          this.moveNodes();
        }

        // increment the counter
        this.adaptiveCounter += 1;
      }
      else {
        // case for the static timestep, we reset it to the one in options and take a normal step.
        this.timestep = this.options.timestep;
        this.calculateForces();
        this.moveNodes();
      }

      // determine if the network has stabilzied
      if (this.stabilized === true) {
        this.revert();
      }

      this.stabilizationIterations++;
    }
  }

  /**
   * Nodes and edges can have the physics toggles on or off. A collection of indices is created here so we can skip the check all the time.
   *
   * @private
   */
  updatePhysicsData(nodeIds) {
    this.physicsBody.forces = {};
    this.physicsBody.physicsNodeIndices = [];
    this.physicsBody.physicsEdgeIndices = [];
    let nodes = this.physicsBody.nodes;
    let edges = this.physicsBody.edges;

    // get node indices for physics
    for (let i = 0; i < nodeIds.length; i++)  {
      if (nodes[nodeIds[i]].physics !== false) {
        this.physicsBody.physicsNodeIndices.push(nodes[nodeIds[i]].id);
      }
    }

    // get edge indices for physics
    for (let i = 0; i < edges.length; i++)  {
      if (edges[i].physics !== false) {
        this.physicsBody.physicsEdgeIndices.push(edges[i].id);
      }
    }

    // get the velocity and the forces vector
    for (let i = 0; i < this.physicsBody.physicsNodeIndices.length; i++) {
      let nodeId = this.physicsBody.physicsNodeIndices[i];
      this.physicsBody.forces[nodeId] = {x:0,y:0};

      // forces can be reset because they are recalculated. Velocities have to persist.
      if (this.physicsBody.velocities[nodeId] === undefined) {
        this.physicsBody.velocities[nodeId] = {x:0,y:0};
      }
    }

    // clean deleted nodes from the velocity vector
    for (let nodeId in this.physicsBody.velocities) {
      if (nodes[nodeId] === undefined) {
        delete this.physicsBody.velocities[nodeId];
      }
    }

  }


  /**
   * Revert the simulation one step. This is done so after stabilization, every new start of the simulation will also say stabilized.
   */
  revert() {
    let nodeIds = Object.keys(this.previousStates);
    let nodes = this.physicsBody.nodes;
    let velocities = this.physicsBody.velocities;
    this.referenceState = {};

    for (let i = 0; i < nodeIds.length; i++) {
      let nodeId = nodeIds[i];
      if (nodes[nodeId] !== undefined) {
        if (nodes[nodeId].physics !== false) {
          this.referenceState[nodeId] = {
            positions: {x:nodes[nodeId].x, y:nodes[nodeId].y}
          };
          velocities[nodeId].x = this.previousStates[nodeId].vx;
          velocities[nodeId].y = this.previousStates[nodeId].vy;
          nodes[nodeId].x = this.previousStates[nodeId].x;
          nodes[nodeId].y = this.previousStates[nodeId].y;
        }
      }
      else {
        delete this.previousStates[nodeId];
      }
    }
  }

  seededRandom() {
    let x = Math.sin(this.physicsBody.randomSeed++) * 10000;
    return x - Math.floor(x);
  }

  positionInitially(nodesObject, nodeIds) {
    for (let i = 0; i < nodeIds.length; i++) {
      let node = nodesObject[nodeIds[i]];
      if (node.fixed !== true) {
        // let radius = this.radius * 0.5 * nodeIds.length + 10;
        // let angle = 2 * Math.PI * this.seededRandom();

        let radius = (2*this.radius + 10*i);
        let angle = i * (2 * Math.PI) / (radius / (1.5*this.radius));

        node.x = node.x || this.options.center.x + radius * Math.cos(angle);
        node.y = node.y || this.options.center.y + radius * Math.sin(angle);
      }
    }
  }


  /**
   * This compares the reference state to the current state
   */
  _evaluateStepQuality() {
    let dx, dy, dpos;
    let nodes = this.physicsBody.nodes;
    let reference = this.referenceState;
    let posThreshold = 0.3;

    for (let nodeId in this.referenceState) {
      if (this.referenceState.hasOwnProperty(nodeId) && nodes[nodeId] !== undefined) {
        dx = nodes[nodeId].x - reference[nodeId].positions.x;
        dy = nodes[nodeId].y - reference[nodeId].positions.y;

        dpos = Math.sqrt(Math.pow(dx,2) + Math.pow(dy,2));

        if (dpos > posThreshold) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * move the nodes one timestep and check if they are stabilized
   * @returns {boolean}
   */
  moveNodes() {
    let nodeIndices = this.physicsBody.physicsNodeIndices;
    let maxVelocity = this.options.maxVelocity ? this.options.maxVelocity : 1e9;
    let maxNodeVelocity = 0;
    let averageNodeVelocity = 0;

    // the velocity threshold (energy in the system) for the adaptivity toggle
    let velocityAdaptiveThreshold = 5;

    for (let i = 0; i < nodeIndices.length; i++) {
      let nodeId = nodeIndices[i];
      let nodeVelocity = this._performStep(nodeId, maxVelocity);
      // stabilized is true if stabilized is true and velocity is smaller than vmin --> all nodes must be stabilized
      maxNodeVelocity = Math.max(maxNodeVelocity,nodeVelocity);
      averageNodeVelocity += nodeVelocity;
    }

    // evaluating the stabilized and adaptiveTimestepEnabled conditions
    this.adaptiveTimestepEnabled = (averageNodeVelocity/nodeIndices.length) < velocityAdaptiveThreshold;
    this.stabilized = maxNodeVelocity < this.options.minVelocity;
  }


  /**
   * Perform the actual step
   *
   * @param nodeId
   * @param maxVelocity
   * @returns {number}
   * @private
   */
  _performStep(nodeId, maxVelocity) {
    let node = this.physicsBody.nodes[nodeId];
    let timestep = this.timestep;
    let forces = this.physicsBody.forces;
    let velocities = this.physicsBody.velocities;

    // store the state so we can revert
    this.previousStates[nodeId] = {x:node.x, y:node.y, vx:velocities[nodeId].x, vy:velocities[nodeId].y};
    if (node.fixed === false) {
      let dx   = this.modelOptions.damping * velocities[nodeId].x;   // damping force
      let ax   = (forces[nodeId].x - dx) / node.mass;                // acceleration
      velocities[nodeId].x += ax * timestep;                         // velocity
      velocities[nodeId].x = (Math.abs(velocities[nodeId].x) > maxVelocity) ? ((velocities[nodeId].x > 0) ? maxVelocity : -maxVelocity) : velocities[nodeId].x;
      node.x   += velocities[nodeId].x * timestep;                    // position
    }
    else {
      forces[nodeId].x = 0;
      velocities[nodeId].x = 0;
    }

    if (node.fixed === false) {
      let dy   = this.modelOptions.damping * velocities[nodeId].y;    // damping force
      let ay   = (forces[nodeId].y - dy) / node.mass;                 // acceleration
      velocities[nodeId].y += ay * timestep;                          // velocity
      velocities[nodeId].y = (Math.abs(velocities[nodeId].y) > maxVelocity) ? ((velocities[nodeId].y > 0) ? maxVelocity : -maxVelocity) : velocities[nodeId].y;
      node.y   += velocities[nodeId].y * timestep;                     // position
    }
    else {
      forces[nodeId].y = 0;
      velocities[nodeId].y = 0;
    }

    let totalVelocity = Math.sqrt(Math.pow(velocities[nodeId].x,2) + Math.pow(velocities[nodeId].y,2));
    return totalVelocity;
  }


  /**
   * calculate the forces for one physics iteration.
   */
  calculateForces() {
    // this.massMover.solve();
    this.gravitySolver.solve();
    this.nodesSolver.solve();
    this.edgesSolver.solve();
  }


  /**
   * Find a stable position for all nodes
   */
  stabilize(iterations = this.options.stabilization.iterations, hidden = false) {
    if (typeof iterations !== 'number') {
      console.error('The stabilize method needs a numeric amount of iterations. Switching to default: ', this.options.stabilization.iterations);
      iterations = this.options.stabilization.iterations;
    }

    if (this.physicsBody.physicsNodeIndices.length === 0) {
      this.ready = true;
      return;
    }

    // enable adaptive timesteps
    this.adaptiveTimestep = this.options.adaptiveTimestep;

    // set stabilize to false
    this.stabilized = false;

    // block redraw requests
    this.targetIterations = iterations;

    this.stabilizationIterations = 0;

    this._stabilizationBatch(hidden);
  }


  /**
   * One batch of stabilization
   * @private
   */
  _stabilizationBatch(hidden = false, count = 0) {
    // this is here to ensure that there is at least one start event.
    if (this.startedStabilization === false) {
      this.startedStabilization = true;
    }

    if (hidden === false) {
      let iterate = (count) => {
        if (this.stabilized === false && count < this.targetIterations) {
          this.physicsTick();
          count++;
          if (this.stabilized === true || count >= this.targetIterations) {
            this.onStable(this.stabilizationIterations);
          }
          else {
            this.onChange(() => { iterate(count) }); // this is async
          }
        }
      };
      iterate(count);

    }
    else {
      while (this.stabilized === false && count < this.options.stabilization.updateInterval && this.stabilizationIterations < this.targetIterations) {
        this.physicsTick();
        count++;
      }
      if (this.stabilized === false && this.stabilizationIterations < this.targetIterations) {
        this._stabilizationBatch(hidden);
      }
      else {
        this.onStable(this.stabilizationIterations);
      }
    }
  }
}

export default PhysicsEngine;