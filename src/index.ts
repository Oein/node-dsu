import udp from "dgram";
import crc from "crc-32";

export type MessageTypes =
  | "ProtocolVersionInformation"
  | "ConnectedControllers"
  | "ControllerData"
  | "ControllerMotor"
  | "Rumble"
  | "Unknown";

export type DSUType = "DSUS" | "DSUC";

export type DSUHeader = {
  dsuType: DSUType;
  version: number;
  packetLength: number;
  CRC32: string;
  senderID: number;
};

export type ControllerState = {
  connected: boolean;
  DPAD: {
    LEFT: boolean;
    DOWN: boolean;
    RIGHT: boolean;
    UP: boolean;
  };
  KEYS: {
    OPTIONS: boolean;
    R3: boolean;
    L3: boolean;
    SHARE: boolean;
    HOME: boolean;
  };
  LSTICK: {
    X: number;
    Y: number;
  };
  RSTICK: {
    X: number;
    Y: number;
  };
  ANALOG: {
    DPAD: {
      LEFT: number;
      DOWN: number;
      RIGHT: number;
      UP: number;
    };
    KEYS: {
      Y: number;
      B: number;
      A: number;
      X: number;
      R1: number;
      L1: number;
      R2: number;
      L2: number;
    };
  };
  MOTION: {
    TIMESTAMP: number;
    ACCEL: {
      X: number;
      Y: number;
      Z: number;
    };
    GYRO: {
      PITCH: number;
      YAW: number;
      ROLL: number;
    };
  };
};

/**
 * DSUServer
 * @description Cemuhook Protocol implementation based on <https://github.com/v1993/cemuhook-protocol>
 * @author Oein <https://github.com/Oein>
 */
export class DSUServer {
  public DATA_port: number;
  public DATA_server: udp.Socket;
  public DATA_CONTROLLERID;
  public DATA_controllerStates: ControllerState[] = [
    this.DSU_dummyState(),
    this.DSU_dummyState(),
    this.DSU_dummyState(),
    this.DSU_dummyState(),
  ];
  /**
   * Generate random controller state
   * @returns Random controller state
   */
  public DSU_randomState(): ControllerState {
    const genrandomState = () => Math.random() > 0.5;
    const genrandomNumber = () => Math.floor(Math.random() * 256);
    const tstamp = Buffer.allocUnsafe(8);
    tstamp.writeDoubleLE(Date.now());

    return {
      connected: true,
      DPAD: {
        LEFT: genrandomState(),
        DOWN: genrandomState(),
        RIGHT: genrandomState(),
        UP: genrandomState(),
      },
      KEYS: {
        OPTIONS: genrandomState(),
        R3: genrandomState(),
        L3: genrandomState(),
        SHARE: genrandomState(),
        HOME: genrandomState(),
      },
      LSTICK: {
        X: genrandomNumber(),
        Y: genrandomNumber(),
      },
      RSTICK: {
        X: genrandomNumber(),
        Y: genrandomNumber(),
      },
      ANALOG: {
        DPAD: {
          LEFT: genrandomNumber(),
          DOWN: genrandomNumber(),
          RIGHT: genrandomNumber(),
          UP: genrandomNumber(),
        },
        KEYS: {
          Y: genrandomNumber(),
          B: genrandomNumber(),
          A: genrandomNumber(),
          X: genrandomNumber(),
          R1: genrandomNumber(),
          L1: genrandomNumber(),
          R2: genrandomNumber(),
          L2: genrandomNumber(),
        },
      },
      MOTION: {
        TIMESTAMP: Date.now(),
        ACCEL: {
          X: genrandomNumber() / 256,
          Y: genrandomNumber() / 256,
          Z: genrandomNumber() / 256,
        },
        GYRO: {
          PITCH: genrandomNumber(),
          YAW: genrandomNumber(),
          ROLL: genrandomNumber(),
        },
      },
    };
  }
  /**
   * Generate dummy controller state
   * @returns Dummy controller state
   */
  public DSU_dummyState(): ControllerState {
    return {
      connected: false,
      DPAD: {
        LEFT: false,
        DOWN: false,
        RIGHT: false,
        UP: false,
      },
      KEYS: {
        OPTIONS: false,
        R3: false,
        L3: false,
        SHARE: false,
        HOME: false,
      },
      LSTICK: {
        X: 0,
        Y: 0,
      },
      RSTICK: {
        X: 0,
        Y: 0,
      },
      ANALOG: {
        DPAD: {
          LEFT: 0,
          DOWN: 0,
          RIGHT: 0,
          UP: 0,
        },
        KEYS: {
          Y: 0,
          B: 0,
          A: 0,
          X: 0,
          R1: 0,
          L1: 0,
          R2: 0,
          L2: 0,
        },
      },
      MOTION: {
        TIMESTAMP: 0,
        ACCEL: {
          X: 0,
          Y: 0,
          Z: 0,
        },
        GYRO: {
          PITCH: 0,
          YAW: 0,
          ROLL: 0,
        },
      },
    };
  }
  /**
   * Set controller state
   * @param index Controller index (0-3)
   */
  public DSU_setControllerState(index: number, state: ControllerState) {
    if (index < 0 || index > 3) throw new Error("Invalid controller index");
    this.DATA_controllerStates[index] = state;
  }
  /**
   * Set all controller states
   * @param state Array of controller states (length 4)
   */
  public DSU_setControllersState(state: ControllerState[]) {
    if (state.length != 4)
      throw new Error("Invalid controller state array length");
    this.DATA_controllerStates = state;
  }
  /**
   * @param msg Message to send including header
   * @returns CRC32 of message
   */
  protected DSU_calcCRC32(msg: Buffer) {
    msg[8] = 0;
    msg[9] = 0;
    msg[10] = 0;
    msg[11] = 0;
    // console.log(msg);
    const c = crc.buf(msg, 0);

    let bigInt = BigInt(c);
    if (bigInt < 0) {
      bigInt = bigInt + BigInt(2 ** 32);
    }
    const littleEndian = Buffer.alloc(4);
    littleEndian.writeUInt32LE(Number(bigInt), 0);
    return littleEndian.toString("hex");
  }
  /**
   * @param n Number
   * @param size Buffer byte size
   * @returns Little endian buffer
   */
  private DSU_number2buffer(n: number, size: number) {
    let littleEndian = Buffer.alloc(size);
    for (let i = 0; i < size; i++) {
      littleEndian[i] = n % 256;
      n = Math.floor(n / 256);
    }
    return littleEndian;
  }
  /**
   * @param buffer Little endian buffer
   * @returns Parsed number
   */
  protected DSU_littleEndian2number(buffer: Buffer) {
    let n = 0;
    let multiplier = 1;
    for (let i = 0; i < buffer.length; i++) {
      n += buffer[i] * multiplier;
      multiplier *= 256;
    }
    return n;
  }
  /**
   * @returns Random 4 byte buffer
   */
  protected DSU_generateID() {
    // generate random 4 byte buffer
    const id = Buffer.alloc(4);
    for (let i = 0; i < 4; i++) {
      id[i] = Math.floor(Math.random() * 256);
    }
    return id;
  }
  /**
   * @param type Message type
   * @returns Buffer of message type
   */
  public DSU_messageType2buffer(type: MessageTypes) {
    const map: { [key in MessageTypes]: Buffer } = {
      ProtocolVersionInformation: Buffer.from([0x00, 0x00, 0x10, 0x00]),
      ConnectedControllers: Buffer.from([0x01, 0x00, 0x10, 0x00]),
      ControllerData: Buffer.from([0x02, 0x00, 0x10, 0x00]),
      ControllerMotor: this.DSU_number2buffer(110001, 4),
      Rumble: this.DSU_number2buffer(110002, 4),
      Unknown: this.DSU_number2buffer(0, 4),
    };
    return map[type];
  }
  /**
   * @param type Message Type
   * @param data Body
   * @returns Buffer to send
   */
  public DSU_generateMessage(type: MessageTypes, data: Buffer) {
    const headerConfig = {
      version: this.DSU_number2buffer(1001, 2),
      dsuType: "DSUS",
      senderID: this.DATA_CONTROLLERID,
    };

    const header = Buffer.alloc(16);
    header.write("DSUS", 0);
    headerConfig.version.copy(header, 4);
    // set packet length later
    // set CRC32 later
    headerConfig.senderID.copy(header, 12);

    const messageTypeBuffer = this.DSU_messageType2buffer(type);

    const result = Buffer.concat([header, messageTypeBuffer, data]);
    const packetLength = this.DSU_number2buffer(
      result.length - header.length,
      2
    );
    packetLength.copy(result, 6);
    const CRC32 = this.DSU_calcCRC32(result);

    // console.log("GEN", CRC32);

    Buffer.from(CRC32, "hex").copy(result, 8);

    return result;
  }
  /**
   * @param msg Message to parse
   * @returns Parsed message
   */
  public DSU_parseMessage(msg: Buffer): {
    header: DSUHeader;
    messageType: MessageTypes;
    message: Buffer;
  } {
    const headerBuffer = msg.slice(0, 16);
    const messageTypeBuffer = msg.slice(16, 20);
    const messageBuffer = msg.slice(20, msg.length);

    const messageTypeHex_ = (
      messageTypeBuffer[0] +
      messageTypeBuffer[1] * 256 +
      messageTypeBuffer[2] * 256 * 256 +
      messageTypeBuffer[3] * 256 * 256 * 256
    ).toString(16);
    const messageType: MessageTypes = ({
      "100000": "ProtocolVersionInformation",
      "100001": "ConnectedControllers",
      "100002": "ControllerData",
      "110001": "ControllerMotor",
      "110002": "Rumble",
    }[messageTypeHex_] || "Unknown") as MessageTypes;

    // Header parse
    const headerData: DSUHeader = {
      dsuType: headerBuffer.slice(0, 4).toString() as "DSUS" | "DSUC",
      version: headerBuffer[4] + headerBuffer[5] * 256,
      packetLength: headerBuffer[6] + headerBuffer[7] * 256,
      CRC32: headerBuffer.slice(8, 12).toString("hex"),
      senderID:
        headerBuffer[12] +
        headerBuffer[13] * 256 +
        headerBuffer[14] * 256 * 256 +
        headerBuffer[15] * 256 * 256 * 256,
    };

    const actualSize = msg.length - headerBuffer.length;
    const calculatedCRC32 = this.DSU_calcCRC32(msg);

    if (actualSize != headerData.packetLength)
      throw new Error("Packet length mismatch");
    if (headerData.CRC32 != calculatedCRC32)
      throw new Error(
        "CRC32 mismatch Expected: " +
          headerData.CRC32 +
          " Actual: " +
          calculatedCRC32
      );

    // console.log("Header: ", headerData);
    // console.log("Actual Size: ", actualSize);
    // console.log("Message Type: ", messageType);
    // console.log("Message: ", [...messageBuffer]);

    return {
      header: headerData,
      messageType,
      message: messageBuffer,
    };
  }
  /**
   * See more on <https://github.com/v1993/cemuhook-protocol#shared-response-beginning-for-message-types-below>
   * @param slot Controller slot
   * @param enabled Controller connected
   * @returns Controller data buffer
   */
  public DSU_createControllerData(slot: number, enabled: boolean = true) {
    const response = Buffer.alloc(12);

    response[0] = slot;

    if (!enabled) return response;

    response[1] = 0x02; // Slot state
    response[2] = 0x02; // Device type
    response[3] = 0x01; // Connection type
    response[10] = 0x05;

    const MACADRESS = Buffer.from(this.DATA_CONTROLLERID, 6);
    MACADRESS[5] = slot;
    MACADRESS.copy(response, 4);

    response[11] = "\0".charCodeAt(0);

    return response;
  }
  /**
   * @param index Controller index
   * @returns Saved controller state
   */
  public DSU_getControllerState = (index: number): ControllerState => {
    return this.DATA_controllerStates[index];
  };
  /**
   * See more on <https://github.com/v1993/cemuhook-protocol#actual-controllers-data>
   * @param slot Controller slot
   * @param state Controller state
   * @returns Actual controller data buffer
   */
  public DSU_state2buffer(
    slot: number,
    state: ControllerState = this.DSU_getControllerState(slot)
  ) {
    const CONTROLLER_INFO = this.DSU_createControllerData(
      slot,
      state.connected
    );

    const CONTROLLER_DATA = Buffer.alloc(80);
    CONTROLLER_INFO.copy(CONTROLLER_DATA, 0);

    // Connection
    CONTROLLER_DATA[11] = state.connected ? 0x01 : 0x00;

    // Packet number
    CONTROLLER_DATA[12] = this.DATA_CONTROLLERID[0];
    CONTROLLER_DATA[13] = this.DATA_CONTROLLERID[1];
    CONTROLLER_DATA[14] = this.DATA_CONTROLLERID[2];
    CONTROLLER_DATA[15] = slot;

    // D-Pad Left, D-Pad Down, D-Pad Right, D-Pad Up, Options (?), R3, L3, Share (?)
    const BOOL2BIT = (bool: boolean) => (bool ? 0x01 : 0x00);
    const BITMASK2BUFFER = (bitmask: (0 | 1)[]) => {
      let result = 0;
      for (let i = 0; i < bitmask.length; i++) {
        result += bitmask[i] * 2 ** i;
      }
      return this.DSU_number2buffer(result, 1);
    };
    CONTROLLER_DATA[16] = BITMASK2BUFFER([
      BOOL2BIT(state.DPAD.LEFT),
      BOOL2BIT(state.DPAD.DOWN),
      BOOL2BIT(state.DPAD.RIGHT),
      BOOL2BIT(state.DPAD.UP),
      BOOL2BIT(state.KEYS.OPTIONS),
      BOOL2BIT(state.KEYS.R3),
      BOOL2BIT(state.KEYS.L3),
      BOOL2BIT(state.KEYS.SHARE),
    ])[0];

    // Y, B, A, X, R1, L1, R2, L2

    // HOME
    CONTROLLER_DATA[18] = this.DSU_number2buffer(
      BOOL2BIT(state.KEYS.HOME),
      1
    )[0];

    // L-Stick X, L-Stick Y
    this.DSU_number2buffer(state.LSTICK.X, 1).copy(CONTROLLER_DATA, 20);
    this.DSU_number2buffer(state.LSTICK.Y, 1).copy(CONTROLLER_DATA, 21);

    // R-Stick X, R-Stick Y
    this.DSU_number2buffer(state.RSTICK.X, 1).copy(CONTROLLER_DATA, 22);
    this.DSU_number2buffer(state.RSTICK.Y, 1).copy(CONTROLLER_DATA, 23);

    // Analog D-Pad Left, Analog D-Pad Down, Analog D-Pad Right, Analog D-Pad Up
    this.DSU_number2buffer(state.ANALOG.DPAD.LEFT, 1).copy(CONTROLLER_DATA, 24);
    this.DSU_number2buffer(state.ANALOG.DPAD.DOWN, 1).copy(CONTROLLER_DATA, 25);
    this.DSU_number2buffer(state.ANALOG.DPAD.RIGHT, 1).copy(
      CONTROLLER_DATA,
      26
    );
    this.DSU_number2buffer(state.ANALOG.DPAD.UP, 1).copy(CONTROLLER_DATA, 27);

    // Analog Y, Analog B, Analog A, Analog X, Analog R1, Analog L1, Analog R2, Analog L2
    this.DSU_number2buffer(state.ANALOG.KEYS.Y, 1).copy(CONTROLLER_DATA, 28);
    this.DSU_number2buffer(state.ANALOG.KEYS.B, 1).copy(CONTROLLER_DATA, 29);
    this.DSU_number2buffer(state.ANALOG.KEYS.A, 1).copy(CONTROLLER_DATA, 30);
    this.DSU_number2buffer(state.ANALOG.KEYS.X, 1).copy(CONTROLLER_DATA, 31);
    this.DSU_number2buffer(state.ANALOG.KEYS.R1, 1).copy(CONTROLLER_DATA, 32);
    this.DSU_number2buffer(state.ANALOG.KEYS.L1, 1).copy(CONTROLLER_DATA, 33);
    this.DSU_number2buffer(state.ANALOG.KEYS.R2, 1).copy(CONTROLLER_DATA, 34);
    this.DSU_number2buffer(state.ANALOG.KEYS.L2, 1).copy(CONTROLLER_DATA, 35);

    // Timestamp
    this.DSU_number2buffer(state.MOTION.TIMESTAMP, 8).copy(CONTROLLER_DATA, 48);

    // Accel X, Accel Y, Accel Z
    const float2buffer = (n: number) => {
      const buffer = Buffer.allocUnsafe(4);
      buffer.writeFloatLE(n);
      return buffer;
    };
    float2buffer(state.MOTION.ACCEL.X).copy(CONTROLLER_DATA, 56);
    float2buffer(state.MOTION.ACCEL.Y).copy(CONTROLLER_DATA, 60);
    float2buffer(state.MOTION.ACCEL.Z).copy(CONTROLLER_DATA, 64);

    // Gyro Pitch, Gyro Yaw, Gyro Roll
    float2buffer(state.MOTION.GYRO.PITCH).copy(CONTROLLER_DATA, 68);
    float2buffer(state.MOTION.GYRO.YAW).copy(CONTROLLER_DATA, 72);
    float2buffer(state.MOTION.GYRO.ROLL).copy(CONTROLLER_DATA, 76);

    return CONTROLLER_DATA;
  }
  public UDP_Handler: ((msg: Buffer, info: udp.RemoteInfo) => any) | undefined =
    undefined;
  private UDP_DefaultHandler(msg: Buffer, info: udp.RemoteInfo) {
    {
      const sendMessage = (msg: Buffer) => {
        // console.log("Sending: ", JSON.stringify(parseMessage(msg), null, 1));
        this.DATA_server.send(msg, info.port, info.address, function (error) {
          if (error) {
            console.log(error);
          }
        });
      };

      try {
        const message = this.DSU_parseMessage(msg);
        // console.log("Received: ", message.messageType);
        switch (message.messageType) {
          case "ConnectedControllers":
            const slotCount2report = this.DSU_littleEndian2number(
              message.message.slice(0, 4)
            );
            // console.log("Slot Count: ", slotCount2report);
            for (let slot = 0; slot < slotCount2report; slot++) {
              sendMessage(
                this.DSU_generateMessage(
                  "ConnectedControllers",
                  this.DSU_createControllerData(
                    message.message[4 + slot],
                    this.DSU_getControllerState(slot).connected
                  )
                )
              );
            }
            break;
          case "ControllerData":
            const SELECTION_TYPE =
              message.message[0] == 0x01
                ? "SLOT"
                : message.message[0] == 0x02
                ? "MAC"
                : "UNKNOWN";
            if (SELECTION_TYPE == "UNKNOWN") break;
            const CONTROLLER_INDEX =
              SELECTION_TYPE == "SLOT"
                ? message.message[1]
                : SELECTION_TYPE == "MAC"
                ? message.message[7]
                : null;
            if (CONTROLLER_INDEX == null) break;
            sendMessage(
              this.DSU_generateMessage(
                "ControllerData",
                this.DSU_state2buffer(CONTROLLER_INDEX)
              )
            );
            break;
          default:
            console.log("Received: ", message.messageType);
            console.log("Message: ", [...message.message]);
            break;
        }
      } catch (e) {
        console.error(e);
      }
    }
  }
  constructor(
    props: {
      port?: number;
      autoStart?: boolean;
      handler?: (this_: DSUServer, msg: Buffer, info: udp.RemoteInfo) => any;
    } = {
      port: 26760,
      autoStart: true,
    }
  ) {
    // creating a udp server
    let server = (this.DATA_server = udp.createSocket("udp4"));
    this.DATA_CONTROLLERID = this.DSU_generateID();

    // emits when any error occurs
    this.DATA_server.on("error", function (error) {
      console.log("Error: " + error);
    });

    // emits on new datagram msg
    let handler: any = (props.handler || this.UDP_DefaultHandler).bind(this);
    let this_ = this;
    this.DATA_server.on("message", (msg, info) => {
      if (props.handler != undefined) handler(this_, msg, info);
      else handler(msg, info);
    });

    //emits when socket is ready and listening for datagram msgs
    server.on("listening", function () {
      var address = server.address();
      var port = address.port;
      var family = address.family;
      var ipaddr = address.address;
      // console.log("Server is listening at port" + port);
      // console.log("Server ip :" + ipaddr);
      // console.log("Server is IP4/IP6 : " + family);
    });

    //emits after the socket is closed using socket.close();
    server.on("close", function () {
      console.log("Socket is closed !");
    });

    this.DATA_port = props.port || 26760;
    if (props.autoStart) server.bind(this.DATA_port);
  }

  public UDP_close() {
    this.DATA_server.close();
  }
  public UDP_start(port?: number) {
    this.DATA_server.bind(port || this.DATA_port);
  }
}

const server = new DSUServer({
  autoStart: true,
  port: 26760,
});

setInterval(() => {
  server.DSU_setControllerState(0, server.DSU_randomState());
}, 100);
