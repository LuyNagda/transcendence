import random, math, pygame, json
from . import gameconfig

ball : pygame.rect
ball_dx : float
ball_dy : float

class AI_ball:
    x: float
    y: float
    dx: float
    dy: float

    def __init__(self, x, y=None, dx=None, dy=None):
        if y == None:
            ball = x
            self.update(ball, ball_dx, ball_dy)
        else:
            self.x = x
            self.y = y
            self.dx = dx
            self.dy = dy

    def __repr__(self):
        return f"x = {self.x}\t\t\ty = {self.y} \ndx = {self.dx}\t\t\tdy = {self.dy}\n"
    
    def update(self, ball, ball_dx, ball_dy):
        self.x = ball.x
        self.y = ball.y
        self.dx = ball_dx
        self.dy = ball_dy

# Create paddles and ball
class Paddle:
    def __init__(self, x, y, width, height):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        # Add center property to match pygame.Rect behavior
        self._center = (x + width/2, y + height/2)
    
    @property
    def center(self):
        return self._center
    
    @center.setter 
    def center(self, value):
        self._center = value
        self.x = value[0] - self.width/2
        self.y = value[1] - self.height/2
    
    @property
    def top(self):
        return self.y
    
    @property
    def bottom(self):
        return self.y + self.height
    
    @property
    def left(self):
        return self.x
    
    @property
    def right(self):
        return self.x + self.width

class Ball:
    def __init__(self, x, y, size):
        self.x = x
        self.y = y
        self.size = size
        self.width = size
        self.height = size
        self._center = (x, y)
    
    @property
    def center(self):
        return self._center
    
    @center.setter
    def center(self, value):
        self._center = value
        self.x = value[0]
        self.y = value[1]
    
    @property 
    def top(self):
        return self.y - self.size/2
    
    @top.setter
    def top(self, value):
        self.y = value + self.size/2
        self._center = (self.x, self.y)
    
    @property
    def bottom(self):
        return self.y + self.size/2
    
    @bottom.setter
    def bottom(self, value):
        self.y = value - self.size/2
        self._center = (self.x, self.y)
    
    @property
    def left(self):
        return self.x - self.size/2
    
    @left.setter
    def left(self, value):
        self.x = value + self.size/2
        self._center = (self.x, self.y)
    
    @property
    def right(self):
        return self.x + self.size/2
    
    @right.setter
    def right(self, value):
        self.x = value - self.size/2
        self._center = (self.x, self.y)

class Frame:
    ball : AI_ball
    leftPaddle : float
    playerDecision : int

    def __init__(self, ball, leftPaddle, playerDecision):
        self.ball = ball
        self.leftPaddle_y = leftPaddle
        self.playerDecision = playerDecision

def ai_bonus_score(ball_y, rightPaddle, Ai_selected):
    dist = abs(ball_y - rightPaddle.top) / gameconfig.HEIGHT

    if dist < 0.05:
        Ai_selected.ai_score = (1 - dist) / 10 + Ai_selected.ai_score 

def reset_ball(ball):
    ball.center = (gameconfig.WIDTH//2, gameconfig.HEIGHT//2)

def collides(ball, paddle):
    if ball.bottom > paddle.top and ball.top < paddle.bottom and ball.left < paddle.right and ball.right > paddle.left:
        return True

    return False

def updateBallAngle(ball, ball_dy, paddle):
    # Calculate the relative's position of the collision with the paddle
    relativeIntersectY = (paddle.y + (paddle.height / 2)) - (ball.y + (ball.height / 2))
    normalizedRelativeIntersectionY = relativeIntersectY / (paddle.height / 2)

    # Calculate the rebound's angle (max 75 degrees)
    bounceAngle = normalizedRelativeIntersectionY * (5 * math.pi / 12)

    # Update the ball's vertical velocity
    ball_dy = gameconfig.BALL_SPEED * -math.sin(bounceAngle)

    return ball_dy

def generate_random_number(low, high):
    return random.randint(low, high)

def train_predefined(Ai_selected, Ai_nb):
    # Initialize game objects
    rightPaddle = Paddle(
        x = gameconfig.WIDTH - 50 - gameconfig.PADDLE_WIDTH,
        y = gameconfig.HEIGHT//2 - gameconfig.PADDLE_HEIGHT//2,
        width = gameconfig.PADDLE_WIDTH,
        height = gameconfig.PADDLE_HEIGHT
    )

    # Predifine game loop
    total_predefined = 0
    for predefined_y in range(round(gameconfig.HEIGHT / 10), gameconfig.HEIGHT, round(gameconfig.HEIGHT / 10)):
        ball = Ball(
            x = 50,
            y = predefined_y,
            size = gameconfig.BALL_SIZE
        )

        for predefined_angle in range(-75, 76):
            total_predefined += 1
            # Ball movement
            ball_dx = gameconfig.BALL_SPEED
            ball_dy = gameconfig.BALL_SPEED * -math.sin(predefined_angle)

            # Update AI's target position
            ai_ball = AI_ball(ball, 0, 0, 0)
            ai_ball.update(ball, ball_dx, ball_dy)

            i = 0
            while (True):
                # Move the ball
                ball.x += ball_dx
                ball.y += ball_dy

                # Update the ai view
                if i % 60 == 0:
                    ai_ball.update(ball, ball_dx, ball_dy)

                # Move the right paddle
                match (Ai_selected.decision(rightPaddle.y, ai_ball, gameconfig.HEIGHT)):
                    case 0:
                        if rightPaddle.top > 0:
                            rightPaddle.y -= gameconfig.PADDLE_SPEED
                    case 1:
                        pass
                    case 2:
                        if rightPaddle.bottom < gameconfig.HEIGHT:
                            rightPaddle.y += gameconfig.PADDLE_SPEED

                # Ball collision with top and bottom
                if ball.top <= 0:
                    ball.top = gameconfig.GRID
                    ball_dy *= -1
                    if abs(ball_dy) < 1:
                        ball_dy = 1 if ball_dy > 0 else -1
                elif ball.bottom >= gameconfig.HEIGHT:
                    ball.bottom = gameconfig.HEIGHT - gameconfig.GRID
                    ball_dy *= -1
                    if abs(ball_dy) < 1:
                        ball_dy = 1 if ball_dy > 0 else -1

                # Ball collision with AI's paddles
                if collides(ball, rightPaddle):
                    if ball.right < rightPaddle.right:
                        Ai_selected.ai_score += 1
                        break

                # Ball out of bounds
                if ball.right >= gameconfig.WIDTH:
                    ai_bonus_score(ball.y, rightPaddle, Ai_selected)
                    break
                
                i += 1

    print(f"\nScore before normal game: {Ai_selected.ai_score:.1f} / {total_predefined}")

def train_normal(Ai_selected, Ai_nb):
    # Initialize game objects
    rightPaddle = Paddle(
        x = gameconfig.WIDTH - 50 - gameconfig.PADDLE_WIDTH,
        y = gameconfig.HEIGHT//2 - gameconfig.PADDLE_HEIGHT//2,
        width = gameconfig.PADDLE_WIDTH,
        height = gameconfig.PADDLE_HEIGHT
    )

    # Normal game loop
    ball = Ball(
        x = gameconfig.WIDTH / 2,
        y = gameconfig.HEIGHT / 2,
        size = gameconfig.BALL_SIZE
    )
    ball_dx = gameconfig.BALL_SPEED
    ball_dy = 0

    # Update AI's target position
    ai_ball = AI_ball(ball, 0, 0, 0)
    ai_ball.update(ball, ball_dx, ball_dy)

    running = True
    left_score = 0
    i = 0
    j = 0
    while running:
        # Limit the game time to GAME_CONF['time_limit'] theoretical minutes
        if gameconfig.get_game_config('time_limit')[0] != 0 \
            and i > (gameconfig.get_game_config('time_limit')[0] * 60 * 60):
            break
        i += 1

        # Move the ball
        ball.x += ball_dx
        ball.y += ball_dy

        # Update the ai view
        if i % 60 == 0:
            ai_ball.update(ball, ball_dx, ball_dy)

        # Move the right paddle
        match (Ai_selected.decision(rightPaddle.y, ai_ball, gameconfig.HEIGHT)):
            case 0:
                # print("AI decision: 0")
                if rightPaddle.top > 0:
                    rightPaddle.y -= gameconfig.PADDLE_SPEED
            case 1:
                # print("AI decision: 1")
                pass
            case 2:
                # print("AI decision: 2")
                if rightPaddle.bottom < gameconfig.HEIGHT:
                    rightPaddle.y += gameconfig.PADDLE_SPEED

        # Ball collision with top and bottom
        if ball.top <= 0:
            ball.top = gameconfig.GRID
            ball_dy *= -1
            if abs(ball_dy) < 1:
                ball_dy = 1 if ball_dy > 0 else -1
        elif ball.bottom >= gameconfig.HEIGHT:
            ball.bottom = gameconfig.HEIGHT - gameconfig.GRID
            ball_dy *= -1
            if abs(ball_dy) < 1:
                ball_dy = 1 if ball_dy > 0 else -1

        # Ball collision with left wall
        if ball.x <= 50:
            ball_dx *= -1
            ball.left = 50
            if j == 0:
                ball_dy = gameconfig.BALL_SPEED * -math.sin(generate_random_number(-75, 75))
                j = 42
            else:
                ball_dy = 0
                j = 0
        # Ball collision with AI's paddles
        if collides(ball, rightPaddle):
            if ball.right < rightPaddle.right:
                ball_dx *= -1
                ball.right = rightPaddle.left
                Ai_selected.ai_score += 1
                ball_dy = updateBallAngle(ball, ball_dy, rightPaddle)

        # Ball out of bounds
        if ball.right >= gameconfig.WIDTH:
            left_score += 1
            # ai_bonus_score(ball.y, rightPaddle, Ai_selected)
            reset_ball(ball)

        # End the game
        if left_score >= gameconfig.get_game_config('max_score')[0]:
            running = False
    
    species_log = f"The AI {Ai_nb} score is {Ai_selected.ai_score:.1f}"
    return species_log

def create_frame(frame_data):
    return Frame(AI_ball(frame_data["ball"]["x"],
                        frame_data["ball"]["y"],
                        frame_data["ball"]["dx"],
                        frame_data["ball"]["dy"]),
                frame_data["leftPaddle"], frame_data["playerDecision"])

def get_human_inputs():
    # Read the file
    try:
        with open("./data.json", 'r') as file:
            json_string = file.read()

            try:
                # First, try to parse the JSON
                parsed_data = json.loads(json_string)
                
                # If it's still a string, parse again
                if isinstance(parsed_data, str):
                    parsed_data = json.loads(parsed_data)
                
                # Get first element if it's nested
                if isinstance(parsed_data, list) and len(parsed_data) > 0:
                    match_stats = parsed_data[0]

                frames = [create_frame(frame) for frame in match_stats]

                return frames

            except json.JSONDecodeError as e:
                print(f"JSON parsing error: {e}")
                return
    except Exception as e:
        return None


# Train against human's inputs
def train_human(Ai_selected, Ai_nb):
    frames = get_human_inputs()

    if frames == None:
        return

    ai_ball = AI_ball(frames[0].ball, 0, 0, 0)
    tick = 0
    for frame in frames:
        # Update the ball's position every second
        if tick % 60 == 0:
            # Mirror ball position for the Ai right's position
            frame.ball.x = gameconfig.WIDTH - frame.ball.x
            ai_ball.update(frame.ball, frame.ball.dx * -1, frame.ball.dy)

        # Compare the AI's decision with the player's decision
        if (Ai_selected.decision(frame.leftPaddle_y, ai_ball, gameconfig.HEIGHT) == frame.playerDecision):
            Ai_selected.ai_score += 0.5
        
        tick += 1