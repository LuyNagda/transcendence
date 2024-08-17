import pygame, random, time, os, pickle
from NNAI import AI_decision, Neuron_Network

save_file = "./bestAI.txt"
Ai_Sample = []

def Init_Ai():
    if (os.path.exists(save_file)):
        with open(save_file, 'rb') as imp:
            for i in range(5):
                Saved_Ai = pickle.load(imp)
                Saved_Ai.ai_score = 0
                Ai_Sample.append(Saved_Ai)
        for i in range(20):
            Ai_Sample.append(Neuron_Network())
    else:
        for i in range(25):
            random_ai = Neuron_Network()
            Ai_Sample.append(random_ai)

def Save_Best_Ai(Ai_Sample):
    Ai_Sample.sort(reverse=True)

    with open(save_file, 'wb') as save:  # Overwrites any existing file.
        for i in range(5):
            pickle.dump(Ai_Sample[i], save, pickle.HIGHEST_PROTOCOL)

    Ai_Sample.clear()

def pong_game(Ai_Sample, SHOW_MATCH):
    # Initialize Pygame
    pygame.init()

    # Set up the game window
    WIDTH = 800
    HEIGHT = 600
    if SHOW_MATCH == "yes":
        window = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Pong")

    # Colors
    WHITE = (255, 255, 255)
    BLACK = (0, 0, 0)

    # Paddle settings
    PADDLE_WIDTH = 15
    PADDLE_HEIGHT = 90
    PADDLE_SPEED = 5

    # Ball settings
    BALL_SIZE = 15
    BALL_SPEED_X = 7
    BALL_SPEED_Y = 7

    # Create paddles and ball
    player = pygame.Rect(50, 0, PADDLE_WIDTH, HEIGHT)
    opponent = pygame.Rect(WIDTH - 50 - PADDLE_WIDTH, HEIGHT//2 - PADDLE_HEIGHT//2, PADDLE_WIDTH, PADDLE_HEIGHT)
    ball = pygame.Rect(WIDTH//2 - BALL_SIZE//2, HEIGHT//2 - BALL_SIZE//2, BALL_SIZE, BALL_SIZE)

    # Set up the game clock
    clock = pygame.time.Clock()

    # Ball movement
    ball_dx = BALL_SPEED_X * random.choice((1, -1))
    ball_dy = BALL_SPEED_Y * random.choice((1, -1))

    # Score
    player_score = 0
    opponent_score = 0

    # Font for score display
    font = pygame.font.Font(None, 36)

    # New variables for opponent's delayed reaction
    last_update_time = time.time()

    class opponent_ball:
        x = ball.x
        y = ball.y
        dx = ball_dx
        dy = ball_dy

    def reset_ball():
        ball.center = (WIDTH//2, HEIGHT//2)
        return BALL_SPEED_X * random.choice((1, -1)), BALL_SPEED_Y * random.choice((1, -1))

    # Game loop
    running = True
    while running:
        keys = pygame.key.get_pressed()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return "STOP"
        if keys[pygame.K_ESCAPE]:
            pygame.quit()
            return "STOP"

        # Move the player's paddle
        if keys[pygame.K_w] and player.top > 0:
            player.y -= PADDLE_SPEED
        if keys[pygame.K_s] and player.bottom < HEIGHT:
            player.y += PADDLE_SPEED

        # Update opponent's target position every second
        current_time = time.time()
        if current_time - last_update_time >= 1:
            opponent_ball.x = ball.x
            opponent_ball.y = ball.y
            opponent_ball.dx = ball_dx
            opponent_ball.dy = ball_dy
            last_update_time = current_time

        # Move the opponent's paddle (simple AI)
        match (AI_decision(Ai_Sample, opponent, opponent_ball, HEIGHT)):
            case 0:
                if opponent.top > 0:
                    opponent.y -= PADDLE_SPEED
            case 1:
                pass
            case 2:
                if opponent.bottom < HEIGHT:
                    opponent.y += PADDLE_SPEED

        # Move the ball
        ball.x += ball_dx
        ball.y += ball_dy

        # Ball collision with top and bottom
        if ball.top <= 0 or ball.bottom >= HEIGHT:
            ball_dy *= -1

        # Ball collision with paddles
        if ball_dx < 0 and player.right >= ball.left and player.top <= ball.centery <= player.bottom:
            if ball.left > player.left:
                ball.left = player.right
                ball_dx *= -1
        elif ball_dx > 0 and opponent.left <= ball.right and opponent.top <= ball.centery <= opponent.bottom:
            if ball.right < opponent.right:
                ball.right = opponent.left
                ball_dx *= -1
                Ai_Sample.ai_score += 1

        # Ball out of bounds
        if ball.left <= 0:
            opponent_score += 1
            ball_dx, ball_dy = reset_ball()
        elif ball.right >= WIDTH:
            player_score += 1
            ball_dx, ball_dy = reset_ball()

        # End the game
        if player_score >= 10:
            running = False

        if SHOW_MATCH == "yes":
            # Clear the screen
            window.fill(BLACK)

            # Draw paddles and ball
            pygame.draw.rect(window, WHITE, player)
            pygame.draw.rect(window, WHITE, opponent)
            pygame.draw.ellipse(window, WHITE, ball)

            # Draw scores
            player_text = font.render(str(player_score), True, WHITE)
            opponent_text = font.render(str(opponent_score), True, WHITE)
            window.blit(player_text, (WIDTH//4, 20))
            window.blit(opponent_text, (3*WIDTH//4, 20))

            # Draw the center line
            pygame.draw.aaline(window, WHITE, (WIDTH//2, 0), (WIDTH//2, HEIGHT))

            # Update the display
            pygame.display.flip()

            # Cap the frame rate
            # clock.tick(60)

    # Quit the game
    pygame.quit()

# Run the game and get the opponent's score
for j in range(1):
    print(f"\n\n========== Sample #{j}===========\n")
    Init_Ai()

    for i in range(10):
        if pong_game(Ai_Sample[i], "no") == "STOP":
            break
        print(f"The AI opponent {i} send back the ball {Ai_Sample[i].ai_score} times")
    Save_Best_Ai(Ai_Sample)